import { useEffect, useState } from "react";
import Admin from "./Admin";
import LoginForm from "@/components/LoginForm";
import { getToken } from "@/lib/auth";

export default function AdminGate() {
  const [authed, setAuthed] = useState<boolean>(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setAuthed(Boolean(getToken()));
    setChecked(true);
  }, []);

  if (!checked) return null;
  if (!authed) return <LoginForm onSuccess={() => setAuthed(true)} />;
  return <Admin />;
}
