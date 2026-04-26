"""Shared MongoDB helper. Mirrors Mongoose's behavior: if the connection string
has no database in the path, default to 'test' (Mongoose's default), so the
Python agent and the Next.js app see the same collections.
"""
from pymongo import MongoClient
from pymongo.errors import ConfigurationError
import os

_client = None


def get_db():
    global _client
    if _client is None:
        _client = MongoClient(os.getenv('MONGODB_URI'))
    try:
        return _client.get_default_database()
    except ConfigurationError:
        return _client['test']
