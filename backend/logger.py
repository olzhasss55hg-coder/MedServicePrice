"""Centralized logging configuration for MedServicePrice backend."""

import logging
import sys

# Ensure UTF-8 output on standard streams when possible
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


def setup_logger(name: str = "medservice", level: int = logging.INFO) -> logging.Logger:
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger

    logger.setLevel(level)

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)-20s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    return logger


api_logger = setup_logger("medservice.api")
parser_logger = setup_logger("medservice.parser")
search_logger = setup_logger("medservice.search")
scheduler_logger = setup_logger("medservice.scheduler")
db_logger = setup_logger("medservice.database")
ai_logger = setup_logger("medservice.ai")
