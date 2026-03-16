from pydantic import BaseModel


class HealthTipResponse(BaseModel):
    id: str
    title: str
    excerpt: str
    category: str
    read_time: str
    image: str
