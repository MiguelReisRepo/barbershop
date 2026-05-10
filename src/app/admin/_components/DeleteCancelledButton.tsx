"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"

interface Props {
  count: number
}

export function DeleteCancelledButton({ count }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  if (count === 0) return null

  async function onClick() {
    const ok = window.confirm(
      `Apagar permanentemente ${count} marcação(ões) cancelada(s)? Esta ação não pode ser revertida.`,
    )
    if (!ok) return
    setBusy(true)
    try {
      const res = await fetch("/api/admin/bookings/cancelled", {
        method: "DELETE",
      })
      if (!res.ok) {
        const t = await res.text()
        alert(`Erro a apagar: ${t || res.status}`)
        return
      }
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-md border border-danger/40 bg-danger/5 px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger/10 transition disabled:opacity-50"
    >
      <Trash2 className="h-3.5 w-3.5" />
      {busy ? "A apagar…" : `Apagar histórico (${count})`}
    </button>
  )
}
