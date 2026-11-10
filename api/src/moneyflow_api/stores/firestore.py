"""Firestore-backed stores. The sync client runs in worker threads."""

import asyncio
import logging
from collections.abc import Callable
from typing import Any

from firebase_admin import auth
from google.cloud import firestore

from moneyflow_api.firebase import FirebaseResources
from moneyflow_api.stores.models import BillingRecord, UsageRecord, next_usage_count

logger = logging.getLogger(__name__)

ClientFactory = Callable[[], firestore.Client]


class FirestoreUsageStore:
    def __init__(self, client: ClientFactory) -> None:
        self._client = client

    async def get(self, uid: str) -> UsageRecord | None:
        return await asyncio.to_thread(self._get, uid)

    async def increment(self, uid: str, day: str) -> int:
        return await asyncio.to_thread(self._increment, uid, day)

    def _get(self, uid: str) -> UsageRecord | None:
        doc = self._client().collection("usage").document(uid).get().to_dict()
        if not doc:
            return None
        day, count = doc.get("day"), doc.get("count")
        if not isinstance(day, str) or not isinstance(count, int):
            return None
        return UsageRecord(day=day, count=count)

    def _increment(self, uid: str, day: str) -> int:
        db = self._client()
        ref = db.collection("usage").document(uid)

        @firestore.transactional
        def run(transaction: firestore.Transaction) -> int:
            snapshot = ref.get(transaction=transaction)
            count = next_usage_count(snapshot.to_dict(), day)
            transaction.set(ref, {"day": day, "count": count})
            return count

        result: int = run(db.transaction())
        return result


class FirestoreBillingStore:
    def __init__(self, client: ClientFactory) -> None:
        self._client = client

    async def get(self, uid: str) -> BillingRecord:
        return await asyncio.to_thread(self._get, uid)

    async def save(self, uid: str, record: BillingRecord) -> None:
        await asyncio.to_thread(self._save, uid, record)

    def _get(self, uid: str) -> BillingRecord:
        doc = self._client().collection("billing").document(uid).get().to_dict()
        return BillingRecord.from_document(doc)

    def _save(self, uid: str, record: BillingRecord) -> None:
        data: dict[str, Any] = {**record.to_document(), "updatedAt": firestore.SERVER_TIMESTAMP}
        self._client().collection("billing").document(uid).set(data)


class FirestoreAccountStore:
    def __init__(self, firebase: FirebaseResources) -> None:
        self._firebase = firebase

    async def delete_account(self, uid: str) -> None:
        await asyncio.to_thread(self._delete, uid)

    def _delete(self, uid: str) -> None:
        db = self._firebase.firestore()
        db.recursive_delete(db.collection("users").document(uid))
        db.collection("billing").document(uid).delete()
        db.collection("usage").document(uid).delete()
        try:
            auth.delete_user(uid, app=self._firebase.app())
        except auth.UserNotFoundError:
            logger.info("Auth user already deleted")
