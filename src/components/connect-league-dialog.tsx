"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api } from "@/trpc/react";

type ConnectLeagueDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected: (leagueId: string) => void;
};

function currentFantasySeasonYear() {
  const now = new Date();
  // NBA fantasy season year flips around October.
  return now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear();
}

export function ConnectLeagueDialog({
  open,
  onOpenChange,
  onConnected,
}: ConnectLeagueDialogProps) {
  const [espnLeagueId, setEspnLeagueId] = useState("");
  const [seasonYear, setSeasonYear] = useState(
    String(currentFantasySeasonYear()),
  );
  const [espnS2, setEspnS2] = useState("");
  const [swid, setSwid] = useState("");
  const [error, setError] = useState<string | null>(null);

  const utils = api.useUtils();
  const connect = api.league.connect.useMutation({
    onSuccess: async (league) => {
      await utils.league.list.invalidate();
      onConnected(league.id);
      onOpenChange(false);
      setEspnLeagueId("");
      setEspnS2("");
      setSwid("");
      setError(null);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect ESPN league</DialogTitle>
          <DialogDescription>
            Enter your ESPN fantasy basketball league ID and season. Private
            leagues also need your espn_s2 and SWID cookies.
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            connect.mutate({
              espnLeagueId,
              seasonYear,
              espnS2: espnS2 || undefined,
              swid: swid || undefined,
            });
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="espn-league-id">League ID</FieldLabel>
              <Input
                id="espn-league-id"
                inputMode="numeric"
                placeholder="123456789"
                value={espnLeagueId}
                onChange={(event) => setEspnLeagueId(event.target.value)}
                required
                disabled={connect.isPending}
              />
              <FieldDescription>
                Found in your ESPN league URL after{" "}
                <span className="font-medium">leagueId=</span>.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="season-year">Season year</FieldLabel>
              <Input
                id="season-year"
                inputMode="numeric"
                value={seasonYear}
                onChange={(event) => setSeasonYear(event.target.value)}
                required
                disabled={connect.isPending}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="espn-s2">espn_s2 (private)</FieldLabel>
              <Input
                id="espn-s2"
                value={espnS2}
                onChange={(event) => setEspnS2(event.target.value)}
                disabled={connect.isPending}
                autoComplete="off"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="swid">SWID (private)</FieldLabel>
              <Input
                id="swid"
                value={swid}
                onChange={(event) => setSwid(event.target.value)}
                disabled={connect.isPending}
                autoComplete="off"
                placeholder="{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}"
              />
              <FieldDescription>
                Leave blank for public leagues. For private leagues, copy both
                cookies from your ESPN browser session.
              </FieldDescription>
            </Field>

            {error ? <FieldError>{error}</FieldError> : null}
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={connect.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={connect.isPending}>
              {connect.isPending ? "Connecting…" : "Connect league"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
