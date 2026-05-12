from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # LLM provider: claude | openai | gemini
    llm_provider: str = "claude"
    llm_model: str = ""           # leave empty to use provider default

    anthropic_api_key: str = ""   # claude
    openai_api_key: str = ""      # openai / chatgpt
    google_api_key: str = ""      # gemini

    db_path: str = "./spendwisely.duckdb"
    owner_name: str = ""   # set in .env — used to detect own-account transfers

    class Config:
        env_file = ".env"


settings = Settings()
