"""Lazy Firebase Admin initialization.

Nothing here runs at import time or in tests: the app and clients are created
on first use, with Application Default Credentials and the configured project.
"""

import threading
from typing import Any

import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore import Client as FirestoreClient


class FirebaseResources:
    def __init__(self, project_id: str) -> None:
        self._project_id = project_id
        self._lock = threading.Lock()
        self._app: Any = None
        self._db: FirestoreClient | None = None

    def app(self) -> Any:
        with self._lock:
            if self._app is None:
                self._app = self._get_or_initialize_app()
            return self._app

    def firestore(self) -> FirestoreClient:
        app = self.app()
        with self._lock:
            if self._db is None:
                self._db = firestore.client(app=app)
            return self._db

    def _get_or_initialize_app(self) -> Any:
        try:
            return firebase_admin.get_app()
        except ValueError:
            return firebase_admin.initialize_app(
                credentials.ApplicationDefault(), {"projectId": self._project_id}
            )
