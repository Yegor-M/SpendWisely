from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    anthropic_api_key: str = ""
    db_path: str = "./spendwisely.duckdb"
    owner_name: str = "YEHOR MAKARENKO"

    class Config:
        env_file = ".env"


settings = Settings()
