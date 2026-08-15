"""add email e senha_hash a cuidadores

Revision ID: afcd88a6d6f7
Revises: fa7d9d632772
Create Date: 2026-08-15 04:14:54.186873

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'afcd88a6d6f7'
down_revision: Union[str, Sequence[str], None] = 'fa7d9d632772'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Dados de dev/teste sem email/senha nao tem como preencher as novas
    # colunas NOT NULL - limpamos as tabelas que dependem de cuidadores
    # (via FK) antes de adicionar as colunas. Decisao explicita do usuario.
    op.execute("DELETE FROM registros_dose")
    op.execute("DELETE FROM idoso_cuidador")
    op.execute("DELETE FROM medicamentos")
    op.execute("DELETE FROM idosos")
    op.execute("DELETE FROM cuidadores")

    op.add_column("cuidadores", sa.Column("email", sa.String(), nullable=False))
    op.add_column("cuidadores", sa.Column("senha_hash", sa.String(), nullable=False))
    op.create_index(
        op.f("ix_cuidadores_email"), "cuidadores", ["email"], unique=True
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_cuidadores_email"), table_name="cuidadores")
    op.drop_column("cuidadores", "senha_hash")
    op.drop_column("cuidadores", "email")
