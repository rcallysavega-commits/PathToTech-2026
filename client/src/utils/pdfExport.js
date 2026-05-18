import api from '../services/api';

const makeSafeFilename = (value = 'report') =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'report';

export async function downloadTemplatePdf({ reportTitle, subtitle = '', columns, rows, fileName }) {
  const response = await api.post(
    '/exports/pdf',
    {
      reportTitle,
      subtitle,
      columns,
      rows,
      fileName: makeSafeFilename(fileName || reportTitle),
    },
    { responseType: 'blob' }
  );

  const blob = new Blob([response.data], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${makeSafeFilename(fileName || reportTitle)}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
