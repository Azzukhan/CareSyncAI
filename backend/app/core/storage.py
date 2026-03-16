from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

BACKEND_ROOT = Path(__file__).resolve().parents[2]
MEDIA_ROOT = BACKEND_ROOT / "media"
LAB_REPORTS_ROOT = MEDIA_ROOT / "lab_reports"


def ensure_storage_dirs() -> None:
    LAB_REPORTS_ROOT.mkdir(parents=True, exist_ok=True)


async def save_lab_report_file(report_file: UploadFile) -> str:
    ensure_storage_dirs()

    original_name = report_file.filename or "report"
    suffix = Path(original_name).suffix.lower()
    if not suffix:
        suffix = ".bin"

    stored_name = f"{uuid4()}{suffix}"
    destination = LAB_REPORTS_ROOT / stored_name
    file_bytes = await report_file.read()
    destination.write_bytes(file_bytes)

    return f"/media/lab_reports/{stored_name}"
