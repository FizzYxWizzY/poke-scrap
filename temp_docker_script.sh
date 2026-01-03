
#!/bin/bash
# Check if MongoDB container is running
if ! docker ps --filter name=mongodb --format "{{.Names}}" | grep -q mongodb; then
    echo "🐳 MongoDB container not running. Starting it..."
    if ! docker start mongodb 2>/dev/null; then
        echo "❌ Failed to start existing MongoDB container. Creating new one..."
        docker run -d --name mongodb -p 27017:27017 mongo:latest
    fi
fi

echo "⏳ Waiting for MongoDB to be ready..."
# Wait for MongoDB to be ready
for i in {1..30}; do
    if docker exec mongodb mongo --eval "db.adminCommand('ping')" --quiet >/dev/null 2>&1; then
        echo "✅ MongoDB is ready!"
        exit 0
    fi
    echo "   Attempt $i/30: MongoDB not ready yet..."
    sleep 2
done

echo "❌ MongoDB failed to start after 60 seconds"
exit 1
