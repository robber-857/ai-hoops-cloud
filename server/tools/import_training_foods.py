"""Import the verified AFCD Release 3 workbooks into a local development database."""
import argparse
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.core.config import settings
from app.services.afcd_import import parse_release
from app.services.food_catalog_service import import_release
from app.services.training_food_service import TrainingFoodService


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source_dir', type=Path)
    args = parser.parse_args()
    url = make_url(settings.database_url)
    if settings.is_production or url.host not in ('localhost', '127.0.0.1'):
        parser.error('This command only imports into a local development database.')
    payload = parse_release(args.source_dir)
    with Session(create_engine(url)) as db:
        print(import_release(db, payload))
        result = TrainingFoodService(db).list(limit=100)
        print({'training_foods': len(result['items']), 'source_available': bool(result.get('source'))})


if __name__ == '__main__':
    main()
