import model

model.load_and_train('dataset/employability.xlsx')

print("=== ECLAT Pattern Discovery ===\n")

# Test with different min_support values
for min_sup in [0.2, 0.15, 0.1]:
    patterns = model.discover_training_patterns(
        min_support=min_sup,
        min_confidence=0.6,
        max_itemset_size=3,
        top_k=15
    )
    print(f"\nmin_support={min_sup} (need ≥{int(3000 * min_sup)} transactions):")
    print(f"  Itemsets found: {len(patterns['frequentItemsets'])}")
    print(f"  Rules found: {len(patterns['associationRules'])}")
    
    if patterns['frequentItemsets']:
        print("  Top 3 itemsets:")
        for i in patterns['frequentItemsets'][:3]:
            print(f"    {i['items']} - support: {i['support']} ({i['supportCount']} txs)")
    
    if patterns['associationRules']:
        print("  Top 2 rules:")
        for r in patterns['associationRules'][:2]:
            print(f"    {r['antecedent']} => {r['consequent']} - conf: {r['confidence']}")
