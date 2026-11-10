from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
SKIP_DIRS = {".venv", ".mypy_cache", ".pytest_cache", ".ruff_cache", "__pycache__"}
TEXT_SUFFIXES = {".py", ".md", ".toml", ".json", ".example", ""}
EM_DASH = chr(0x2014)


def project_files() -> list[Path]:
    return [
        path
        for path in API_ROOT.rglob("*")
        if path.is_file()
        and not SKIP_DIRS.intersection(path.relative_to(API_ROOT).parts)
        and path.suffix in TEXT_SUFFIXES
        and path.name != "uv.lock"
    ]


def test_no_em_dash_anywhere() -> None:
    offenders = [
        str(path.relative_to(API_ROOT))
        for path in project_files()
        if EM_DASH in path.read_text(encoding="utf-8", errors="ignore")
    ]

    assert offenders == []


def test_source_files_stay_under_700_lines() -> None:
    too_long = [
        str(path.relative_to(API_ROOT))
        for path in project_files()
        if path.suffix == ".py" and len(path.read_text(encoding="utf-8").splitlines()) >= 700
    ]

    assert too_long == []
