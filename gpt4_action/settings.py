import os

# Openai key to query word-embedding
openai_key = os.environ.get("OPENAI_KEY", "")
if not openai_key:
    raise ValueError("OPENAI_KEY is not set")

# openai embedding model
embedding_name = os.environ.get("EMBEDDING_NAME", "text-embedding-ada-002")
# embedding_name = "text-embedding-ada-002"
# embedding_name = "text-embedding-3-large"

# FAISS Index folder
folder_index = f"./index_{embedding_name}"

# token for chatGPT action
auth_token = os.environ.get("AUTH_TOKEN", "openai_token")
