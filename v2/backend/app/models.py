from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel


class Transaction(BaseModel):
    id: str
    booking_date: date
    value_date: Optional[date] = None
    month: str
    counterparty: str
    counterparty_address: str = ""
    title: str
    amount: float
    abs_amount: float
    currency: str
    direction: str        # expense | income | internal
    category: str
    bank_category: str = ""
    operation_type: str = ""
    source_account: str = ""
    target_account: str = ""
    reference: str = ""
    is_internal: bool = False
    source_file: str = ""
    imported_at: Optional[datetime] = None


class TransactionPatch(BaseModel):
    category: str


class CategoryRule(BaseModel):
    category: str
    pattern: str
    fields: list[str] = ["counterparty", "title", "operation_type"]
    priority: int = 0
    comment: str = ""


class ManualTransaction(BaseModel):
    booking_date: date
    description: str
    amount: float
    currency: str = "PLN"
    category: str = "Uncategorized"


class UncategorizedGroup(BaseModel):
    counterparty: str
    sample_title: str
    count: int
    total_amount: float
    tx_ids: list[str]


class BulkCategorizeItem(BaseModel):
    tx_ids: list[str]
    category: str
    save_rule: bool = False
    counterparty: str = ""


class BulkCategorizeResult(BaseModel):
    updated: int
    rules_created: int
    additionally_categorized: int


class SuggestItem(BaseModel):
    id: str
    counterparty: str
    title: str
    abs_amount: float = 0.0
    currency: str = "PLN"
    bank_category: str = ""


class IngestResult(BaseModel):
    source_file: str
    total_rows: int
    imported: int
    duplicates_skipped: int
    internal_marked: int
    categorized: int
    uncategorized: int
    uncategorized_groups: list[UncategorizedGroup] = []


class Summary(BaseModel):
    total_income: float
    total_expenses: float
    net_balance: float
    avg_monthly_income: float
    avg_monthly_expenses: float
    savings_rate_pct: float
    transaction_count: int
    expense_count: int
    income_count: int
    months_covered: int
    unique_counterparties: int
    largest_single_expense: float
    largest_single_income: float
    budget_health_score: float
    budget_health_label: str
