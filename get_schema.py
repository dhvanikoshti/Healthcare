import json
from google.cloud import firestore
from google.oauth2 import service_account

path_to_json = 'credentials.json'
credentials = service_account.Credentials.from_service_account_file(path_to_json)
db = firestore.Client(credentials=credentials)

def get_type_schema(collection_name):
    """Scans the database for a specific collection name and returns field types."""
    print(f"Searching for structure of: {collection_name}...")
    # This looks across all users for any collection with this name
    docs = list(db.collection_group(collection_name).limit(1).get())
    
    if docs:
        data = docs[0].to_dict()
        return {field: type(value).__name__ for field, value in data.items()}
    return "No data found in any document of this collection type."

def run_hunter():
    final_dictionary = {
        "healthTips": get_type_schema("healthTips"),
        "users": get_type_schema("users"),
        "reports": get_type_schema("reports"),
        "chats": get_type_schema("chats")
    }

    with open('firestore_final_schema.json', 'w') as f:
        json.dump(final_dictionary, f, indent=4)
    
    print("\n✅ Success! Open 'firestore_final_schema.json' to see the full fields.")

if __name__ == "__main__":
    run_hunter()