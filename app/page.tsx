import { redirect } from "next/navigation"
import { connection } from "next/server"
import { Suspense } from "react"
import { createChatSession } from "@/services/chat"

const StartNewChat = async () => {
  await connection()
  const { id } = await createChatSession()
  redirect(`/chat/${id}`)
}

const Home = () => (
  <Suspense fallback={<p className="m-auto text-sm text-muted-foreground">Starting a new chat…</p>}>
    <StartNewChat />
  </Suspense>
)

export default Home
