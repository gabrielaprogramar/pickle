"use client";

import { useState } from "react";
import { useSettings } from "@/hooks/use-settings";
import { useAuth } from "@/hooks/use-auth";
import { SettingsCard, ChoiceField } from "@/components/settings/settings-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROLES, roleLabel } from "@/lib/roles/catalog";
import type { SettingsInvite, SettingsUser } from "@/lib/settings";

const ROLE_OPTIONS = ROLES.map((r) => ({ value: r.code, label: r.label }));

function StatusBadge({ status }: { readonly status: string }) {
  if (status === "active")
    return <Badge variant="success">Active</Badge>;
  if (status === "pending")
    return <Badge variant="warning">Pending</Badge>;
  return <Badge variant="muted">Inactive</Badge>;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function UsersSettingsPage() {
  const { bundle, isLoading, inviteUser, cancelInvite, resendInvite, changeUser } =
    useSettings();
  const { user: me } = useAuth();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [changing, setChanging] = useState<string | null>(null);
  const [changeError, setChangeError] = useState<string | null>(null);

  if (isLoading || !bundle) {
    return <Skeleton className="h-96 w-full" />;
  }

  async function onInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError(null);
    try {
      await inviteUser({
        email: inviteEmail,
        fullName: inviteName.trim() || null,
        role: inviteRole,
      });
      setInviteEmail("");
      setInviteName("");
      setInviteRole("viewer");
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setInviting(false);
    }
  }

  async function onChangeRole(user: SettingsUser, role: string) {
    if (role === user.role) return;
    setChanging(user.id);
    setChangeError(null);
    try {
      await changeUser(user.id, { role });
    } catch (err) {
      setChangeError(
        err instanceof Error ? err.message : "Could not change role",
      );
    } finally {
      setChanging(null);
    }
  }

  async function onToggleStatus(user: SettingsUser) {
    setChanging(user.id);
    setChangeError(null);
    try {
      await changeUser(user.id, {
        status: user.status === "active" ? "inactive" : "active",
      });
    } catch (err) {
      setChangeError(
        err instanceof Error ? err.message : "Could not change status",
      );
    } finally {
      setChanging(null);
    }
  }

  const isSelf = (user: SettingsUser) => user.email === me?.email;

  return (
    <div className="max-w-3xl">
      {changeError && (
        <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {changeError}
        </p>
      )}

      <SettingsCard
        title="Invite a member"
        description="Send an email invitation with a role. Emails are simulated in this environment."
      >
        <form onSubmit={onInvite} className="space-y-3">
          {inviteError && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {inviteError}
            </p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                required
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                disabled={inviting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-name">Full name</Label>
              <Input
                id="invite-name"
                placeholder="Optional"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                disabled={inviting}
              />
            </div>
          </div>
          <div className="flex items-end justify-between gap-3">
            <div className="w-48 space-y-1.5">
              <Label htmlFor="invite-role">Role</Label>
              <Select
                id="invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                disabled={inviting}
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" disabled={inviting}>
              {inviting ? "Inviting…" : "Send invite"}
            </Button>
          </div>
        </form>
      </SettingsCard>

      <SettingsCard title="Members" description="People with access to this workspace">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last login</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bundle.users.map((user) => {
              const self = isSelf(user);
              const busy = changing === user.id;
              return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.fullName}
                    {self && (
                      <span className="ml-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
                        (you)
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-[11px]">
                    {user.email}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      disabled={busy || self}
                      onChange={(e) => onChangeRole(user, e.target.value)}
                      className="h-7 w-44"
                    >
                      {ROLE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={user.status} />
                      {!self && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px]"
                          disabled={busy}
                          onClick={() => onToggleStatus(user)}
                        >
                          {user.status === "active" ? "Deactivate" : "Activate"}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(user.lastLoginAt)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </SettingsCard>

      {bundle.invites.length > 0 && (
        <SettingsCard title="Invitations" description="Outstanding invites and their status">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bundle.invites.map((invite) => (
                <InviteRow
                  key={invite.id}
                  invite={invite}
                  onResend={() => resendInvite(invite.id)}
                  onCancel={() => cancelInvite(invite.id)}
                />
              ))}
            </TableBody>
          </Table>
        </SettingsCard>
      )}
    </div>
  );
}

function InviteRow({
  invite,
  onResend,
  onCancel,
}: {
  readonly invite: SettingsInvite;
  readonly onResend: () => void;
  readonly onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const isPending = invite.status === "pending";

  return (
    <TableRow>
      <TableCell className="font-mono text-[11px]">{invite.email}</TableCell>
      <TableCell>{roleLabel(invite.role)}</TableCell>
      <TableCell>
        <StatusBadge status={invite.status} />
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatDate(invite.expiresAt)}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {invite.resendCount > 0 ? `${invite.resendCount + 1}×` : "1×"}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          {isPending && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px]"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await onResend();
                  setBusy(false);
                }}
              >
                Resend
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] text-destructive"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await onCancel();
                  setBusy(false);
                }}
              >
                Cancel
              </Button>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
