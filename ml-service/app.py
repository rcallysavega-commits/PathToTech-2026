import os
import logging
import threading
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import model as ml_model

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATASET_PATH = os.getenv("DATASET_PATH", "dataset/employability.xlsx")


def _train_model_on_startup():
    try:
        if os.path.exists(DATASET_PATH):
            info = ml_model.load_and_train(DATASET_PATH)
            logger.info(f"Model trained: {info}")
        else:
            logger.warning(f"Dataset not found at {DATASET_PATH}. Model not trained.")
    except Exception as exc:
        logger.exception(f"Startup model training failed: {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("PathToTech ML Service starting up...")
    # Avoid blocking web server startup on heavy training so Render can detect an open port.
    threading.Thread(target=_train_model_on_startup, daemon=True).start()
    yield
    logger.info("ML Service shutting down.")


app = FastAPI(title="PathToTech ML Service", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PredictRequest(BaseModel):
    gwa: float
    surveyScores: dict
    technicalSkillsCount: int
    softSkillsAverage: float
    certificationCount: int
    certWeight: Optional[float] = 1.0   # 0.0–1.0; relevance weight of approved certifications
    skills: list = []
    certifications: list = []


class PatternDiscoveryRequest(BaseModel):
    minSupport: Optional[float] = 0.2
    minConfidence: Optional[float] = 0.6
    maxItemsetSize: Optional[int] = 3
    topK: Optional[int] = 20


@app.get("/")
def health():
    return {"status": "ok", "service": "PathToTech ML Service"}


@app.post("/predict")
def predict(payload: PredictRequest):
    if not ml_model.is_model_ready():
        raise HTTPException(
            status_code=503,
            detail="Model is still training. Please retry in a few seconds."
        )
    try:
        result = ml_model.predict(payload.dict())
        return result
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/training-info")
def training_info():
    info = ml_model.get_training_info()
    if not info:
        raise HTTPException(status_code=503, detail="Model not trained yet.")
    return info


@app.get("/features")
def features():
    return ml_model.get_features()


@app.get("/model-summary")
def model_summary():
    return ml_model.get_model_summary()


@app.get("/model-performance")
def model_performance():
    return ml_model.get_model_performance_data()


@app.get("/dataset-options")
def dataset_options():
    try:
        return ml_model.get_dataset_options()
    except Exception as e:
        logger.error(f"Dataset options error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/patterns/discover")
def discover_patterns(payload: PatternDiscoveryRequest):
    return ml_model.discover_training_patterns(
        min_support=float(payload.minSupport or 0.2),
        min_confidence=float(payload.minConfidence or 0.6),
        max_itemset_size=int(payload.maxItemsetSize or 3),
        top_k=int(payload.topK or 20),
    )


@app.get("/gmm-visualization")
def gmm_visualization():
    if not ml_model.is_model_ready():
        raise HTTPException(status_code=503, detail="Model not trained yet.")
    return ml_model.get_gmm_visualization_data()


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=False)
