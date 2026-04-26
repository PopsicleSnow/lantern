from db import get_db


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
