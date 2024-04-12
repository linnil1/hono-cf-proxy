import os
from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import (
    CharacterTextSplitter,
    # MarkdownHeaderTextSplitter,
    Language,
    RecursiveCharacterTextSplitter,
)
from langchain_community.vectorstores import FAISS
from langchain_community.document_loaders import (
    # UnstructuredMarkdownLoader,
    DirectoryLoader,
)
import settings


def readDocs(folder_docs):
    loader = DirectoryLoader(folder_docs, glob="**/*.md", show_progress=True)
    text_splitter = CharacterTextSplitter(
        separator="\n\n",
        chunk_size=3000,
        chunk_overlap=300,
    )
    # headers_to_split_on = [
    #     ("#", "Header 1"),
    #     ("##", "Header 2"),
    #     ("###", "Header 3"),
    # ]
    # markdown_splitter = MarkdownHeaderTextSplitter(
    #    headers_to_split_on=headers_to_split_on, strip_headers=False)
    # docs = loader.load_and_split(markdown_splitter)
    docs = loader.load_and_split(text_splitter)
    return docs


def readCodes(folder_codes):
    loader = DirectoryLoader(folder_codes, glob="**/*.ts", show_progress=True)
    python_splitter = RecursiveCharacterTextSplitter.from_language(
        language=Language.TS, chunk_size=1000, chunk_overlap=100
    )
    docs = loader.load_and_split(python_splitter)
    return docs


def debugPrint(docs):
    from pprint import pprint

    for i in range(10):
        pprint(docs[i].to_json()["kwargs"])


if __name__ == "__main__":
    docs = [
        *readDocs("hono"),
        *readDocs("hono-cf-proxy"),
        *readDocs("hono-cf-proxy.wiki"),
        *readDocs("cloudflare-docs/content/workers"),
        *readCodes("hono-cf-proxy"),
    ]
    embeddings = OpenAIEmbeddings(openai_api_key=settings.openai_key, deployment=settings.embedding_name)
    db = FAISS.from_documents(docs, embeddings)
    db.save_local(settings.folder_index)
