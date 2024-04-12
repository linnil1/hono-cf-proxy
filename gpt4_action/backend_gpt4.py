from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import FAISS
from pydantic import BaseModel

import settings


# config
app = FastAPI()
security = HTTPBearer()
embeddings = OpenAIEmbeddings(
    openai_api_key=settings.openai_key,
    deployment=settings.embedding_name
)
docsearch = FAISS.load_local(settings.folder_index, embeddings, allow_dangerous_deserialization=True)


class QueryRequest(BaseModel):
    query: str


def requires_auth(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """A fixed auth for chatGPT action to used"""
    if credentials.credentials != settings.auth_token:
        raise HTTPException(status_code=401, detail="Unauthorized")


def get_related_documents(query: str):
    """Main: Search the documents"""
    result = docsearch.similarity_search(query, k=10)
    result = [{"source": r.metadata["source"], "text": r.page_content} for r in result]
    return result


@app.post("/query")
async def get_related_documents_api(
    query_request: QueryRequest,
    credentials: HTTPAuthorizationCredentials = Depends(requires_auth),
):
    """
    Retrieve query parameter from the request
    and return related documents
    """
    related_documents = get_related_documents(query_request.query)
    print("Query", query_request.query, [i["source"] for i in related_documents])
    return related_documents


# run it
# uvicorn backend_gpt4:app --host 0.0.0.0 --port 5001 --reload
# test it
# curl -H "Authorization: Bearer openai_token" http://localhost:5001/query -d '{"query": "hono"}' -H "Content-Type: application/json" -X POST
