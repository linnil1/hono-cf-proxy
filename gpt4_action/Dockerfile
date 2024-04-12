FROM python:3.11-slim-bullseye
COPY requirements.txt .
RUN pip install -r requirements.txt
WORKDIR /app
COPY *.py /app/
EXPOSE 5001
CMD ["uvicorn", "backend_gpt4:app", "--workers", "2", "--host", "0.0.0.0", "--port", "5001"]