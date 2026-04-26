from db import get_db
from bson import ObjectId
from bson.errors import InvalidId


async def find_matching_journalists(beats: list[str]) -> list[dict]:
    db = get_db()
    query_beats = beats if beats else ['general']
    return list(
        db.journalists.find(
            {
                'beats': {'$in': query_beats},
                'active': True,
                'public_key': {'$exists': True, '$ne': None},
            },
            {'_id': 1, 'name': 1, 'organization': 1, 'beats': 1,
             'public_key': 1, 'securedrop_url': 1}
        ).sort('tip_count', 1).limit(5)
    )


async def find_all_journalists() -> list[dict]:
    db = get_db()
    return list(
        db.journalists.find(
            {'active': True, 'public_key': {'$exists': True, '$ne': None}},
            {'_id': 1, 'beats': 1, 'public_key': 1}
        )
    )


async def find_journalists_for_preferences(
    preferences: dict,
    beats: list[str],
) -> list[dict]:
    """Honor tipper preferences strictly. Returns [] if the filter matches nobody."""
    db = get_db()
    base = {'active': True, 'public_key': {'$exists': True, '$ne': None}}

    journalist_id = preferences.get('journalist_id')
    if journalist_id:
        try:
            oid = ObjectId(journalist_id)
        except (InvalidId, TypeError):
            return []
        doc = db.journalists.find_one(
            {**base, '_id': oid},
            {'_id': 1, 'public_key': 1}
        )
        return [doc] if doc else []

    query = dict(base)
    organization = preferences.get('organization')
    if organization:
        query['organization'] = organization
    category = preferences.get('category')
    if category:
        query['beats'] = {'$in': beats if beats else [category, 'general']}

    return list(
        db.journalists.find(query, {'_id': 1, 'public_key': 1}).sort('tip_count', 1).limit(5)
    )
