import sqlite3

conn = sqlite3.connect("rms.db")
tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
for (table,) in tables:
    conn.execute(f"DELETE FROM {table}")
    print(f"  Cleared: {table}")
conn.commit()
conn.close()
print("Database is now empty.")
