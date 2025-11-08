"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bitcoin, Zap, Copy, CheckCircle, QrCode, AlertCircle, Info } from "lucide-react";
import { Federation } from "@/lib/types/fmcd";

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  federation: Federation;
}

enum DepositTabs {
  Lightning = "lightning",
  Onchain = "onchain",
}

// Type guard function to ensure runtime type safety
function isValidDepositTab(value: string): value is DepositTabs {
  return Object.values(DepositTabs).includes(value as DepositTabs);
}

export function DepositModal({ isOpen, onClose, federation }: DepositModalProps) {
  const params = useParams<{ teamId: string }>();
  const [activeTab, setActiveTab] = useState(DepositTabs.Lightning);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [isGeneratingAddress, setIsGeneratingAddress] = useState(false);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [depositAddress, setDepositAddress] = useState("");
  const [lightningInvoice, setLightningInvoice] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);

  const formatFederationName = () => {
    return federation.config.global.federation_name || "Unknown Federation";
  };

  const shortenFederationId = () => {
    const id = federation.federation_id;
    if (!id) return "unknown";
    return `${id.slice(0, 8)}...${id.slice(-8)}`;
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(label);
      setTimeout(() => setCopiedText(null), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  };

  const generateDepositAddress = async () => {
    setIsGeneratingAddress(true);
    setAddressError(null);

    try {
      const response = await fetch(`/api/team/${params.teamId}/fmcd/address`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          federationId: federation.federation_id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate address");
      }

      if (!data.address) {
        throw new Error("No address received from server");
      }

      setDepositAddress(data.address);
    } catch (error) {
      console.error("Error generating onchain address:", error);
      setAddressError(error instanceof Error ? error.message : "Unknown error occurred");
    } finally {
      setIsGeneratingAddress(false);
    }
  };

  const generateLightningInvoice = async () => {
    if (!invoiceAmount || parseInt(invoiceAmount) <= 0) {
      setInvoiceError("Please enter a valid amount");
      return;
    }

    setIsGeneratingInvoice(true);
    setInvoiceError(null);

    try {
      const amount_sats = parseInt(invoiceAmount);
      const amount_msat = amount_sats * 1000;

      const requestBody = {
        amountMsat: amount_msat,
        federationId: federation.federation_id,
        description: `Deposit to ${federation.config.global.federation_name || "Federation"}`,
      };

      const response = await fetch(`/api/team/${params.teamId}/fmcd/invoice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate invoice");
      }

      if (!data.invoice) {
        throw new Error("No invoice received from server");
      }

      setLightningInvoice(data.invoice);
    } catch (error) {
      console.error("Error generating Lightning invoice:", error);
      setInvoiceError(error instanceof Error ? error.message : "Unknown error occurred");
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  const resetModal = () => {
    setActiveTab(DepositTabs.Lightning);
    setDepositAddress("");
    setLightningInvoice("");
    setInvoiceAmount("");
    setCopiedText(null);
    setIsGeneratingAddress(false);
    setIsGeneratingInvoice(false);
    setInvoiceError(null);
    setAddressError(null);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const handleTabChange = (value: string) => {
    // Type-safe validation using type guard
    if (isValidDepositTab(value)) {
      setActiveTab(value);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            Deposit to Federation
          </DialogTitle>
          <DialogDescription>
            Deposit funds to <strong>{formatFederationName()}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4">
          <Card className="border-dashed">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">{formatFederationName()}</CardTitle>
                <Badge variant="outline" className="text-xs">
                  {shortenFederationId()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Info className="w-4 h-4" />
                <span>Deposits may take some time to appear in your balance</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value={DepositTabs.Lightning} className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Lightning
            </TabsTrigger>
            <TabsTrigger value={DepositTabs.Onchain} className="flex items-center gap-2">
              <Bitcoin className="w-4 h-4" />
              Onchain
            </TabsTrigger>
          </TabsList>

          <TabsContent value={DepositTabs.Lightning} className="space-y-4">
            <div className="space-y-3">
              <div>
                <Label htmlFor="amount" className="text-sm font-medium">
                  Amount (sats)
                </Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="Enter amount in satoshis"
                  value={invoiceAmount}
                  onChange={e => setInvoiceAmount(e.target.value)}
                  className="mt-1"
                  min="1"
                />
              </div>

              <Button
                onClick={generateLightningInvoice}
                disabled={!invoiceAmount || parseInt(invoiceAmount) <= 0 || isGeneratingInvoice}
                className="w-full"
              >
                {isGeneratingInvoice ? "Generating Invoice..." : "Generate Lightning Invoice"}
              </Button>

              {invoiceError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                  <div className="text-sm text-red-800">
                    <p className="font-medium">Error:</p>
                    <p>{invoiceError}</p>
                  </div>
                </div>
              )}

              {lightningInvoice && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Lightning Invoice</Label>
                  <div className="flex items-center gap-2">
                    <Input value={lightningInvoice} readOnly className="font-mono text-xs" />
                    <Button
                      onClick={() => copyToClipboard(lightningInvoice, "invoice")}
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                    >
                      {copiedText === "invoice" ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>

                  <div className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg">
                    <div className="text-center">
                      <QrCode className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                      <span className="text-sm text-muted-foreground">QR Code placeholder</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium">Lightning Network:</p>
                      <p>
                        This invoice will expire in 24 hours. Lightning deposits are typically
                        instant.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {!lightningInvoice && (
                <div className="flex items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg">
                  <div className="text-center">
                    <Zap className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Enter an amount to generate a Lightning invoice
                    </p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value={DepositTabs.Onchain} className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Bitcoin Address</Label>
                {!depositAddress && (
                  <Button
                    onClick={generateDepositAddress}
                    disabled={isGeneratingAddress}
                    size="sm"
                    variant="outline"
                  >
                    {isGeneratingAddress ? "Generating..." : "Generate"}
                  </Button>
                )}
              </div>

              {addressError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                  <div className="text-sm text-red-800">
                    <p className="font-medium">Error:</p>
                    <p>{addressError}</p>
                  </div>
                </div>
              )}

              {depositAddress ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Generated Address</Label>
                    <Button
                      onClick={generateDepositAddress}
                      disabled={isGeneratingAddress}
                      size="sm"
                      variant="outline"
                    >
                      {isGeneratingAddress ? "Generating..." : "Generate New"}
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Input value={depositAddress} readOnly className="font-mono text-xs" />
                    <Button
                      onClick={() => copyToClipboard(depositAddress, "address")}
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                    >
                      {copiedText === "address" ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>

                  <div className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg">
                    <div className="text-center">
                      <QrCode className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                      <span className="text-sm text-muted-foreground">QR Code placeholder</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
                    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <div className="text-sm text-amber-800">
                      <p className="font-medium">Important:</p>
                      <p>
                        Only send Bitcoin to this address. Sending other cryptocurrencies may result
                        in permanent loss.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg">
                  <div className="text-center">
                    <Bitcoin className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Generate a deposit address to receive Bitcoin
                    </p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
