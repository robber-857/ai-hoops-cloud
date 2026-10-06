"""Repeatable isolated local recipe demo. Source test database is read-only."""
import os
from pathlib import Path
from uuid import UUID
from sqlalchemy import create_engine, select, text
from sqlalchemy.engine import URL
from sqlalchemy.orm import Session


def main():
    source_url = URL.create('postgresql+psycopg', username='p2_test', password=os.environ['LOCAL_DEMO_PASSWORD'], host='127.0.0.1', port=55439, database='ai_hoops_p2_test')
    target_url = source_url.set(database='ai_hoops_recipe_demo')
    os.environ['DATABASE_URL'] = target_url.render_as_string(hide_password=False)
    os.environ['APP_ENV'] = 'development'
    source = create_engine(source_url)
    with source.connect().execution_options(isolation_level='AUTOCOMMIT') as conn:
        if not conn.scalar(text("SELECT 1 FROM pg_database WHERE datname='ai_hoops_recipe_demo'")):
            conn.execute(text('CREATE DATABASE ai_hoops_recipe_demo'))
    from alembic.config import Config
    from alembic import command
    root = Path(__file__).resolve().parents[1]
    config = Config(str(root / 'alembic.ini'))
    config.set_main_option('script_location', str(root / 'alembic'))
    command.upgrade(config, 'head')
    from app.main import create_app
    from app.models.user import User
    from app.models.food_catalog import FoodRelease, FoodEntry
    from app.schemas.recipe import RecipeCreate
    from app.services.recipe_service import RecipeService
    from sqlalchemy.dialects.postgresql import insert
    target = create_engine(target_url)
    with source.connect() as src, target.begin() as dst:
        release = src.execute(select(FoodRelease.__table__).where(FoodRelease.name == 'AFCD Release 3')).mappings().one()
        for table, rows in [
            (FoodRelease.__table__, [release]),
            (FoodEntry.__table__, src.execute(select(FoodEntry.__table__).where(FoodEntry.release_id == release['id'])).mappings().all()),
            (User.__table__, src.execute(select(User.__table__).where(User.username.in_(['names_admin', 'p3_coach', 'p3_student']))).mappings().all()),
        ]:
            for row in rows:
                dst.execute(insert(table).values(dict(row)).on_conflict_do_nothing(index_elements=['id']))
            dst.execute(text(f"SELECT setval(pg_get_serial_sequence('{table.name}', 'id'), COALESCE((SELECT MAX(id) FROM {table.name}),1))"))
    recipes = [
        ('101', '鸡蛋西兰花米饭 / Egg, broccoli & rice bowl', [('F007661','300'),('F003721','100'),('F001900','160')], '1. 称量煮熟且无添加盐的米饭、去壳水煮蛋和煮熟沥干的西兰花。\n2. 切开鸡蛋，与米饭和西兰花分成两碗。\n3. 本示例没有额外添加油、盐或酱汁。', ['Egg / 鸡蛋'], '2'),
        ('102', '西兰花糙米碗 / Broccoli & brown rice', [('F007641','300'),('F001900','200')], '1. 称量煮熟且无添加盐的糙米，以及煮熟沥干的西兰花。\n2. 混合并分成两份，不额外添加油、盐或酱汁。\n3. 此示例不代表完整一餐建议。', [], '2'),
        ('103', '香蕉水果碗 / Fresh banana bowl', [('F000262','120')], '1. 选用 Cavendish 香蕉，去皮后称量可食部分。\n2. 切片装碗。本示例不含酸奶、坚果或其他配料。', [], '1'),
    ]
    with Session(target) as db:
        admin = db.scalar(select(User).where(User.username == 'names_admin'))
        assert admin is not None
        service = RecipeService(db)
        for suffix, title, ingredients, instructions, allergens, servings in recipes:
            payload = RecipeCreate(request_id=UUID('a10c0000-0000-4000-8000-000000000'+suffix), title='[本地演示 / Local demo] '+title, instructions=instructions, servings=servings, allergens=allergens, allergens_reviewed=False,
                dietary_notes='仅限本地功能演示，不是正式营养方案。过敏原须由机构审核；未列出不代表无过敏原。食品原名、生熟状态和来源保持 AFCD 原文。',
                ingredients=[dict(release_id=release['id'], food_key=key, edible_grams=grams, preparation_note='按 AFCD 原名所示状态称量可食部分 / Weigh in the stated AFCD food state.') for key,grams in ingredients])
            saved = service.create(admin, payload)
            service.publish(admin, payload.request_id, 1)
            print(title)
    print('Local demo ready: ai_hoops_recipe_demo. Source recipes unchanged.')

if __name__ == '__main__':
    main()
