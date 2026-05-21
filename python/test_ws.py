import asyncio
import websockets

async def handler(websocket):
    print("Path is:", websocket.request.path)
    await websocket.close()

async def main():
    async with websockets.serve(handler, "localhost", 8765):
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
