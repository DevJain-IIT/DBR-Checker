"""add reports.review_decisions

Revision ID: a1b2c3d4e5f6
Revises: 27e4b2549dc5
Create Date: 2026-06-13 00:00:00.000000

Stores the engineer's per-check sign-off on REVIEW items, e.g.
{"D9": "accepted", "D12": "revise", "D20": "ignored"}. JSON column,
default empty object so existing rows are valid.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '27e4b2549dc5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'reports',
        sa.Column('review_decisions', sa.JSON(), nullable=False,
                  server_default=sa.text("'{}'")),
    )


def downgrade() -> None:
    op.drop_column('reports', 'review_decisions')
