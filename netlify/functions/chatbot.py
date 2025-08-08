import json
import os
import requests

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
ASSISTANT_ID = os.getenv("ASSISTANT_ID")
VECTOR_STORE_ID = os.getenv("VECTOR_STORE_ID")

BLOCKED_WORDS = ["hack", "illegal", "kill"]

OPENAI_BASE_URL = "https://api.openai.com/v1"

HEADERS_OPENAI = {
    "Authorization": f"Bearer {OPENAI_API_KEY}",
    "Content-Type": "application/json"
}

HEADERS_TAVILY = {
    "Authorization": f"Bearer {TAVILY_API_KEY}",
    "Content-Type": "application/json"
}

def is_question_valid(query):
    q = query.lower()
    return not any(word in q for word in BLOCKED_WORDS)

def tavily_search(query):
    try:
        payload = {
            "query": query,
            "search_depth": "basic",
            "include_answer": True,
            "include_raw_content": False
        }
        response = requests.post("https://api.tavily.com/search", headers=HEADERS_TAVILY, json=payload)
        response.raise_for_status()
        data = response.json()
        return data.get("answer", "No relevant results found.")
    except Exception as e:
        print("Tavily search error:", e)
        return "Error fetching search results."

def normalize_thread_id(raw):
    if raw is None:
        return None
    if isinstance(raw, str):
        return raw.strip()
    if isinstance(raw, dict):
        if "id" in raw and isinstance(raw["id"], str):
            return raw["id"].strip()
        first_val = next(iter(raw.values()), None)
        if isinstance(first_val, str):
            return first_val.strip()
    return str(raw).strip()

def handler(event, context):
    if event["httpMethod"] != "POST":
        return {
            "statusCode": 405,
            "body": json.dumps({"error": "Method not allowed"})
        }
    
    try:
        content_type = event["headers"].get("content-type") or event["headers"].get("Content-Type") or ""
        if "application/json" in content_type:
            body = json.loads(event.get("body") or "{}")
        else:
            # handle form-url-encoded
            from urllib.parse import parse_qs
            body = parse_qs(event.get("body") or "")
            # parse_qs returns lists per key
            body = {k: v[0] for k,v in body.items()}

        query = body.get("query", "").strip()
        thread_id = normalize_thread_id(body.get("thread_id"))

        # Validate thread_id is string or None
        if thread_id and not isinstance(thread_id, str):
            thread_id = str(thread_id)
        thread_id = thread_id.strip() if thread_id else None

        print(f"Received query: {query}")
        print(f"Thread ID: {thread_id}")

        if not query or not is_question_valid(query):
            return {
                "statusCode": 200,
                "body": json.dumps({
                    "thread_id": thread_id or None,
                    "response": "This question is not appropriate or relevant. Please ask something based on your role or documents."
                })
            }

        if not ASSISTANT_ID or not VECTOR_STORE_ID:
            return {
                "statusCode": 500,
                "body": json.dumps({"error": "Missing VECTOR_STORE_ID or ASSISTANT_ID"})
            }

        # Create a new thread if no thread_id provided
        if not thread_id:
            url = f"{OPENAI_BASE_URL}/assistants/{ASSISTANT_ID}/threads"
            resp = requests.post(url, headers=HEADERS_OPENAI)
            resp.raise_for_status()
            data = resp.json()
            thread_id = data.get("id")
            if not thread_id:
                raise Exception("Failed to create a new thread")
            print(f"Created new thread: {thread_id}")

        # Send user message
        url_send_msg = f"{OPENAI_BASE_URL}/threads/{thread_id}/messages"
        payload_msg = {
            "role": "user",
            "content": query
        }
        resp = requests.post(url_send_msg, headers=HEADERS_OPENAI, json=payload_msg)
        resp.raise_for_status()

        # Run assistant
        url_run = f"{OPENAI_BASE_URL}/assistants/{ASSISTANT_ID}/threads/{thread_id}/runs"
        resp = requests.post(url_run, headers=HEADERS_OPENAI)
        resp.raise_for_status()
        run_data = resp.json()

        # Handle tool calls if required
        if run_data.get("required_action", {}).get("type") == "submit_tool_outputs":
            tool_outputs = []
            for call in run_data["required_action"]["submit_tool_outputs"]["tool_calls"]:
                fn_name = call["function"]["name"]
                args = json.loads(call["function"]["arguments"])
                output = "Unknown tool"

                if fn_name == "tavily_search":
                    output = tavily_search(args.get("query", ""))

                tool_outputs.append({
                    "tool_call_id": call["id"],
                    "output": output
                })

            # Submit tool outputs and poll again
            url_submit_tools = f"{OPENAI_BASE_URL}/threads/{thread_id}/runs/{run_data['id']}/tool_outputs"
            resp = requests.post(url_submit_tools, headers=HEADERS_OPENAI, json={"tool_outputs": tool_outputs})
            resp.raise_for_status()
            run_data = resp.json()

        # Get messages for thread
        url_messages = f"{OPENAI_BASE_URL}/threads/{thread_id}/messages"
        resp = requests.get(url_messages, headers=HEADERS_OPENAI)
        resp.raise_for_status()
        messages_data = resp.json()

        # Extract assistant responses
        assistant_messages = [m for m in messages_data.get("data", []) if m.get("role") == "assistant"]
        final_response = "\n".join(
            m.get("content", {}).get("text", {}).get("value", "") for m in assistant_messages
        ).strip()

        if not final_response:
            final_response = "⚠️ Assistant did not return a message."

        return {
            "statusCode": 200,
            "body": json.dumps({
                "thread_id": thread_id,
                "response": final_response
            })
        }

    except Exception as e:
        print("Error in chatbot function:", e)
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }
