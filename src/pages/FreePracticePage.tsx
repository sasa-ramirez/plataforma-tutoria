import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Wand2 } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/common/Spinner";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { generatePracticeExercise } from "@/services/practice";
import { LANGUAGE_META, DIFFICULTY_META } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Difficulty, ProgLanguage } from "@/types/database";

const LANGS = Object.keys(LANGUAGE_META) as ProgLanguage[];
const DIFFS = Object.keys(DIFFICULTY_META) as Difficulty[];

export function FreePracticePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [language, setLanguage] = useState<ProgLanguage>("python");
  const [difficulty, setDifficulty] = useState<Difficulty>("beginner");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const id = await generatePracticeExercise({ language, difficulty, topic });
      navigate(`/app/solve/${id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo generar", "error");
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Práctica libre con IA"
        subtitle="Elige lenguaje, dificultad y tema. La IA te crea un ejercicio y luego lo califica."
      />

      <Card>
        <CardContent className="space-y-5 p-5">
          {/* Lenguaje */}
          <div className="space-y-2">
            <Label>Lenguaje</Label>
            <div className="flex flex-wrap gap-2">
              {LANGS.map((l) => (
                <button
                  key={l}
                  onClick={() => setLanguage(l)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors",
                    language === l
                      ? "bg-primary/15 text-primary ring-1 ring-primary/40"
                      : "bg-muted text-muted-foreground hover:bg-muted/70",
                  )}
                >
                  <span>{LANGUAGE_META[l].emoji}</span>
                  {LANGUAGE_META[l].label}
                </button>
              ))}
            </div>
          </div>

          {/* Dificultad */}
          <div className="space-y-2">
            <Label>Dificultad</Label>
            <div className="flex flex-wrap gap-2">
              {DIFFS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={cn(
                    "rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors",
                    difficulty === d
                      ? "bg-primary/15 text-primary ring-1 ring-primary/40"
                      : "bg-muted text-muted-foreground hover:bg-muted/70",
                  )}
                >
                  {DIFFICULTY_META[d].label}
                </button>
              ))}
            </div>
          </div>

          {/* Tema */}
          <div className="space-y-2">
            <Label htmlFor="topic">Tema (opcional)</Label>
            <Input
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ej. bucles, arreglos, condicionales, funciones…"
            />
          </div>

          <Button
            variant="brand"
            size="lg"
            className="w-full"
            onClick={generate}
            disabled={loading}
          >
            {loading ? (
              <>
                <Spinner className="size-4" /> Generando ejercicio…
              </>
            ) : (
              <>
                <Wand2 className="size-4" /> Generar ejercicio
              </>
            )}
          </Button>

          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-accent" />
            La IA crea el enunciado y, al enviar tu solución, te califica.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
