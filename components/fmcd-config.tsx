"use client";

import { useUser } from "@stackframe/stack";
import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle, XCircle, AlertCircle, Eye, EyeOff } from "lucide-react";
import { FMCDConfiguration, FMCDStatus, TestConnectionResponse } from "@/lib/types/fmcd";

export function FMCDConfigComponent() {
  const user = useUser({ or: "redirect" });
  const params = useParams<{ teamId: string }>();
  const team = user.useTeam(params.teamId);

  const [config, setConfig] = useState<FMCDConfiguration | null>(null);
  const [status, setStatus] = useState<FMCDStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    baseUrl: "",
    password: "",
    isActive: true,
  });
  const [testResult, setTestResult] = useState<TestConnectionResponse | null>(null);

  // Check if user has team admin permission
  const isTeamAdmin = team ? user.usePermission(team, "team_admin") : null;

  const loadConfig = useCallback(async () => {
    try {
      const response = await fetch(`/api/team/${params.teamId}/fmcd/config`);
      if (response.ok) {
        const data = await response.json();
        setConfig(data.config);
        setStatus(data.status);
        if (data.config) {
          setFormData({
            baseUrl: data.config.baseUrl,
            password: data.config.password,
            isActive: data.config.isActive,
          });
        }
      }
    } catch (error) {
      console.error("Failed to load config:", error);
    } finally {
      setLoading(false);
    }
  }, [params.teamId]);

  useEffect(() => {
    if (!params.teamId) {
      setLoading(false);
      return;
    }

    if (!team) {
      return; // Still loading team
    }

    if (isTeamAdmin === null) {
      return; // Still checking permissions
    }

    if (isTeamAdmin) {
      loadConfig();
    } else {
      setLoading(false);
    }
  }, [isTeamAdmin, params.teamId, loadConfig, team]);

  // Failsafe timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        setLoading(false);
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeout);
  }, [loading]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/team/${params.teamId}/fmcd/config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await loadConfig();
        setTestResult(null); // Clear previous test results
      } else {
        const error = await response.json();
        console.error("Save failed:", error);
      }
    } catch (error) {
      console.error("Save error:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const response = await fetch(`/api/team/${params.teamId}/fmcd/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          baseUrl: formData.baseUrl,
          password: formData.password,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setTestResult(result);
        await loadConfig(); // Refresh status
      }
    } catch (error) {
      console.error("Test error:", error);
      setTestResult({
        isConnected: false,
        error: "Network error occurred",
      });
    } finally {
      setTesting(false);
    }
  };

  const getStatusBadge = () => {
    if (!status) return null;

    if (status.isConnected) {
      return (
        <Badge variant="default" className="bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Connected
        </Badge>
      );
    } else {
      return (
        <Badge variant="destructive">
          <XCircle className="w-3 h-3 mr-1" />
          Disconnected
        </Badge>
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading configuration...
      </div>
    );
  }

  if (!isTeamAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Admin Access Required
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              Only team administrators can modify FMCD configuration settings. Contact your team
              administrator to modify connection settings.
            </AlertDescription>
          </Alert>
          {status && (
            <div className="mt-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <span className="text-sm font-medium">Connection Status:</span>
                {getStatusBadge()}
              </div>
              {status.lastChecked && (
                <p className="text-xs text-muted-foreground mt-1">
                  Last checked: {new Date(status.lastChecked).toLocaleString()}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                <span className="text-lg">📡 FMCD Instance Configuration</span>
              </CardTitle>
              <CardDescription className="mt-1">
                Configure the FMCD instance for this team. All team members will access the same
                instance.
              </CardDescription>
            </div>
            <div className="flex-shrink-0">
              {getStatusBadge()}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {status && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Status:</span>
                  {getStatusBadge()}
                </div>
                <span className="text-xs text-muted-foreground">
                  Last checked: {new Date(status.lastChecked).toLocaleString()}
                </span>
              </div>
              {status.version && (
                <p className="text-xs text-muted-foreground mt-1">Version: {status.version}</p>
              )}
              {status.error && <p className="text-xs text-red-600 mt-1">Error: {status.error}</p>}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor="baseUrl">FMCD Base URL</Label>
              <Input
                id="baseUrl"
                placeholder="http://localhost:3333"
                value={formData.baseUrl}
                onChange={e => setFormData(prev => ({ ...prev, baseUrl: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                The URL where your FMCD instance is running (including port)
              </p>
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter FMCD password"
                  value={formData.password}
                  onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                The password for authenticating with your FMCD instance
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={e => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                className="rounded"
              />
              <Label htmlFor="isActive">Enable FMCD integration</Label>
            </div>
          </div>

          {testResult && (
            <Alert
              className={
                testResult.isConnected ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
              }
            >
              <AlertDescription
                className={testResult.isConnected ? "text-green-800" : "text-red-800"}
              >
                {testResult.isConnected ? (
                  <>
                    ✅ Connection successful!{" "}
                    {testResult.version && `(Version: ${testResult.version})`}
                  </>
                ) : (
                  <>❌ Connection failed: {testResult.error}</>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col sm:flex-row gap-2 sm:space-x-2 pt-4">
            <Button
              onClick={handleTest}
              variant="outline"
              disabled={testing || !formData.baseUrl || !formData.password}
              className="w-full sm:w-auto"
            >
              {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              <span className="hidden sm:inline">Test Connection</span>
              <span className="sm:hidden">Test</span>
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formData.baseUrl || !formData.password}
              className="w-full sm:w-auto"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              <span className="hidden sm:inline">Save Configuration</span>
              <span className="sm:hidden">Save</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
