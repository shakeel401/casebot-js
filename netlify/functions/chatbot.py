import os
import json
from openai import OpenAI
from tavily import TavilyClient
from filter import is_question_valid  # Your custom input filter

# Load environment variables (make sure to set these in Netlify environment settings)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")

client = OpenAI(api_key=OPENAI_API_KEY)
tavily_client = TavilyClient(api_key=TAVILY_API_KEY)

def tavily_search(query: str) -> str:
    try:
        response = tavily_client.search(
            query=query,
            search_depth="advanced",
            max_results=3
        )
        if response.get("answer"):
            return response["answer"]
        results = response.get("results", [])
        if results:
            return "\n".join([f"{res['title']}: {res['url']}" for res in results])
        return "No relevant results found on the web."
    except Exception as e:
        return f"Error performing Tavily search: {str(e)}"

def handler(event, context):
    if event.get("httpMethod") != "POST":
        return {
            "statusCode": 405,
            "body": json.dumps({"error": "Method Not Allowed"}),
            "headers": {"Content-Type": "application/json"},
        }

    try:
        body = json.loads(event.get("body") or "{}")
        query = body.get("query", "").strip()
        thread_id = body.get("thread_id")

        if not query or not is_question_valid(query):
            return {
                "statusCode": 200,
                "body": json.dumps({
                    "thread_id": thread_id,
                    "response": "This question is not appropriate or relevant. Please ask something based on your role or documents."
                }),
                "headers": {"Content-Type": "application/json"},
            }

        vector_store_id = os.getenv("VECTOR_STORE_ID")
        assistant_id = os.getenv("ASSISTANT_ID")
        if not vector_store_id or not assistant_id:
            return {
                "statusCode": 500,
                "body": json.dumps({"error": "Missing VECTOR_STORE_ID or ASSISTANT_ID"}),
                "headers": {"Content-Type": "application/json"},
            }

        if not thread_id:
            thread = client.beta.threads.create()
            thread_id = thread.id

        client.beta.threads.messages.create(
            thread_id=thread_id,
            role="user",
            content=query
        )

        run = client.beta.threads.runs.create_and_poll(
            thread_id=thread_id,
            assistant_id=assistant_id
        )

        if run.required_action and run.required_action.type == "submit_tool_outputs":
            tool_outputs = []

            for action in run.required_action.submit_tool_outputs.tool_calls:
                function_name = action.function.name
                arguments = json.loads(action.function.arguments)

                if function_name == "tavily_search":
                    query_text = arguments.get("query", "")
                    result = tavily_search(query_text)
                else:
                    result = "Unknown tool requested."

                tool_outputs.append({
                    "tool_call_id": action.id,
                    "output": result
                })

            run = client.beta.threads.runs.submit_tool_outputs_and_poll(
                thread_id=thread_id,
                run_id=run.id,
                tool_outputs=tool_outputs
            )

        messages = client.beta.threads.messages.list(thread_id=thread_id).data
        assistant_messages = [m for m in messages if m.role == "assistant"]

        if not assistant_messages:
            return {
                "statusCode": 500,
                "body": json.dumps({"error": "No response from assistant"}),
                "headers": {"Content-Type": "application/json"},
            }

        assistant_response = assistant_messages[0].content[0].text.value

        return {
            "statusCode": 200,
            "body": json.dumps({"thread_id": thread_id, "response": assistant_response}),
            "headers": {"Content-Type": "application/json"},
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)}),
            "headers": {"Content-Type": "application/json"},
        }
