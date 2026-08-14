import logging
import json
from datetime import datetime

class WebSocketLogHandler(logging.Handler):
    """
    Custom logging handler to broadcast logs to connected WebSocket clients.
    """
    def __init__(self, server=None):
        super().__init__()
        self.server = server

    def set_server(self, server):
        self.server = server

    def emit(self, record):
        try:
            log_entry = {
                "timestamp": datetime.fromtimestamp(record.created).isoformat(),
                "level": record.levelname,
                "name": record.name,
                "message": record.getMessage(),
                "filename": record.filename,
                "lineno": record.lineno,
            }
            # Add correlation ID if present in extra context
            if hasattr(record, "correlation_id"):
                log_entry["correlation_id"] = record.correlation_id
            
            if self.server and self.server.clients:
                import asyncio
                try:
                    # Fetch current event loop and schedule broadcast task if loop is running
                    loop = asyncio.get_event_loop()
                    if loop.is_running():
                        loop.create_task(
                            self.server.broadcast(log_entry, event_name="system_log")
                        )
                except Exception:
                    pass
        except Exception:
            self.handleError(record)

class StructuredFormatter(logging.Formatter):
    """
    Formats logs as structured JSON or human-readable format.
    """
    def format(self, record):
        log_data = {
            "time": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "module": record.module,
            "message": record.getMessage(),
        }
        if hasattr(record, "correlation_id"):
            log_data["correlation_id"] = record.correlation_id
        return json.dumps(log_data)

# WebSocket log handler singleton
ws_handler = WebSocketLogHandler()

def setup_logger(level=logging.INFO, server=None):
    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    # Console Handler (Human-readable structured logging)
    console_handler = logging.StreamHandler()
    console_formatter = logging.Formatter(
        "[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    console_handler.setFormatter(console_formatter)
    
    # Associate the websocket server instance
    ws_handler.set_server(server)

    # Clear existing handlers and register new ones
    root_logger.handlers = []
    root_logger.addHandler(console_handler)
    root_logger.addHandler(ws_handler)

    return root_logger
