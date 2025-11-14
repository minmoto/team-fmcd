"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, CheckCircle, Coins, AlertTriangle, Loader2, Zap, Bitcoin } from "lucide-react";
import { Federation, TransactionChannel } from "@/lib/types/fmcd";

interface TransferFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  federations: Federation[];
  onTransferComplete?: () => void;
}

type TransferStep = "setup" | "confirm" | "processing" | "complete";

interface TransferDetails {
  sourceFederation: Federation | null;
  destinationFederation: Federation | null;
  amount: string;
  useMaxAmount: boolean;
  transactionChannel: TransactionChannel;
}

export function TransferFundsModal({
  isOpen,
  onClose,
  federations,
  onTransferComplete,
}: TransferFundsModalProps) {
  const params = useParams<{ teamId: string }>();
  const [step, setStep] = useState<TransferStep>("setup");
  const [details, setDetails] = useState<TransferDetails>({
    sourceFederation: null,
    destinationFederation: null,
    amount: "",
    useMaxAmount: false,
    transactionChannel: TransactionChannel.Lightning,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep("setup");
      setDetails({
        sourceFederation: null,
        destinationFederation: null,
        amount: "",
        useMaxAmount: false,
        transactionChannel: TransactionChannel.Lightning,
      });
      setError(null);
      setLoading(false);
    }
  }, [isOpen]);

  // Auto-select preferred channel when federations change
  useEffect(() => {
    if (details.sourceFederation && details.destinationFederation) {
      const sourceHasGateways = (details.sourceFederation.gatewayCount ?? 0) > 0;
      const destHasGateways = (details.destinationFederation.gatewayCount ?? 0) > 0;

      // Prefer lightning if both have gateways, otherwise onchain
      const preferredChannel =
        sourceHasGateways && destHasGateways
          ? TransactionChannel.Lightning
          : TransactionChannel.Bitcoin;

      setDetails(prev => ({
        ...prev,
        transactionChannel: preferredChannel,
      }));
    }
  }, [details.sourceFederation, details.destinationFederation]);

  // Show all federations for source selection (including 0 balance)
  const allFederationsForSource = federations;

  // Filter destination federations (exclude source and match network)
  const destinationFederations = federations.filter(
    fed =>
      fed.federation_id !== details.sourceFederation?.federation_id &&
      fed.config.global.network === details.sourceFederation?.config.global.network
  );

  // Channel availability logic
  const getAvailableChannels = (): TransactionChannel[] => {
    if (!details.sourceFederation || !details.destinationFederation) {
      return [TransactionChannel.Lightning, TransactionChannel.Bitcoin];
    }

    const sourceHasGateways = (details.sourceFederation.gatewayCount ?? 0) > 0;
    const destHasGateways = (details.destinationFederation.gatewayCount ?? 0) > 0;

    const channels: TransactionChannel[] = [];

    // Lightning only available if both federations have gateways
    if (sourceHasGateways && destHasGateways) {
      channels.push(TransactionChannel.Lightning);
    }

    // Bitcoin always available
    channels.push(TransactionChannel.Bitcoin);

    return channels;
  };

  const getPreferredChannel = (): TransactionChannel => {
    const availableChannels = getAvailableChannels();

    if (!details.sourceFederation || !details.destinationFederation) {
      return TransactionChannel.Lightning;
    }

    const sourceHasGateways = (details.sourceFederation.gatewayCount ?? 0) > 0;
    const destHasGateways = (details.destinationFederation.gatewayCount ?? 0) > 0;

    // Prefer lightning if both have gateways, otherwise bitcoin
    return sourceHasGateways && destHasGateways
      ? TransactionChannel.Lightning
      : TransactionChannel.Bitcoin;
  };

  const formatSats = (msats: number) => {
    return (msats / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  const getFederationName = (federation: Federation) => {
    return federation.config.global.federation_name || "Unknown Federation";
  };

  const getMaxTransferSats = () => {
    if (!details.sourceFederation) return 0;
    return Math.floor(details.sourceFederation.balance_msat / 1000);
  };

  const validateAmount = () => {
    if (details.useMaxAmount) return true;

    const amount = parseFloat(details.amount);
    if (isNaN(amount) || amount <= 0) {
      setError("Amount must be greater than 0");
      return false;
    }

    const maxSats = getMaxTransferSats();
    if (amount > maxSats) {
      setError(
        `Amount exceeds available balance (${formatSats(details.sourceFederation!.balance_msat)} sats)`
      );
      return false;
    }

    setError(null);
    return true;
  };

  // Pure validation function without side effects for render-time checks
  const isAmountValid = () => {
    if (details.useMaxAmount) return true;

    const amount = parseFloat(details.amount);
    if (isNaN(amount) || amount <= 0) return false;

    const maxSats = getMaxTransferSats();
    return amount <= maxSats;
  };

  const canProceedToConfirm = () => {
    return (
      details.sourceFederation &&
      details.sourceFederation.balance_msat > 0 &&
      details.destinationFederation &&
      (details.useMaxAmount || (details.amount && isAmountValid()))
    );
  };

  const getTransferAmount = () => {
    if (details.useMaxAmount) {
      return getMaxTransferSats();
    }
    return parseFloat(details.amount) || 0;
  };

  const handleSetMaxAmount = () => {
    setDetails(prev => ({
      ...prev,
      useMaxAmount: true,
      amount: getMaxTransferSats().toString(),
    }));
  };

  const handleAmountChange = (value: string) => {
    setDetails(prev => ({
      ...prev,
      amount: value,
      useMaxAmount: false,
    }));
    setError(null);
  };

  const handleTransfer = async () => {
    // Prevent duplicate submissions
    if (loading) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setStep("processing");

      const transferAmountMsats = getTransferAmount() * 1000;

      if (details.transactionChannel === TransactionChannel.Lightning) {
        // Lightning transfer via invoice
        // Step 1: Get lightning invoice from destination federation
        // Use the first available gateway from destination federation
        if (
          !details.destinationFederation!.gateways ||
          details.destinationFederation!.gateways.length === 0
        ) {
          throw new Error("No gateways available for destination federation");
        }

        const gatewayId = details.destinationFederation!.gateways[0].info.gateway_id;

        const invoiceResponse = await fetch(`/api/team/${params.teamId}/fmcd/invoice`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            federationId: details.destinationFederation!.federation_id,
            gatewayId: gatewayId,
            amountMsat: transferAmountMsats,
            description: `Transfer from ${getFederationName(details.sourceFederation!)} to ${getFederationName(details.destinationFederation!)}`,
          }),
        });

        if (!invoiceResponse.ok) {
          const errorData = await invoiceResponse.json();
          throw new Error(errorData.error || "Failed to generate lightning invoice");
        }

        const { invoice } = await invoiceResponse.json();

        // Step 2: Pay the invoice from source federation
        // Use the first available gateway from source federation
        if (
          !details.sourceFederation!.gateways ||
          details.sourceFederation!.gateways.length === 0
        ) {
          throw new Error("No gateways available for source federation");
        }

        const sourceGatewayId = details.sourceFederation!.gateways[0].info.gateway_id;

        const payResponse = await fetch(`/api/team/${params.teamId}/fmcd/pay-invoice`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            federationId: details.sourceFederation!.federation_id,
            invoice,
            gatewayId: sourceGatewayId,
          }),
        });

        if (!payResponse.ok) {
          const errorData = await payResponse.json().catch(() => ({}));

          // Handle specific error cases
          if (payResponse.status === 408) {
            throw new Error(
              "Payment is taking longer than expected. The payment may still be processing. Please check your transaction history."
            );
          }

          throw new Error(errorData.error || "Failed to complete lightning payment");
        }
      } else {
        // Onchain transfer via Bitcoin address
        // Step 1: Get Bitcoin address from destination federation
        const addressResponse = await fetch(`/api/team/${params.teamId}/fmcd/address`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            federationId: details.destinationFederation!.federation_id,
          }),
        });

        if (!addressResponse.ok) {
          const errorData = await addressResponse.json();
          throw new Error(errorData.error || "Failed to generate Bitcoin address");
        }

        const { address } = await addressResponse.json();

        if (!address) {
          throw new Error("No address received from server");
        }

        // Step 2: Send Bitcoin to the address from source federation
        const sendResponse = await fetch(`/api/team/${params.teamId}/fmcd/send-onchain`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            federationId: details.sourceFederation!.federation_id,
            address,
            amountSats: Math.floor(transferAmountMsats / 1000),
          }),
        });

        if (!sendResponse.ok) {
          const errorData = await sendResponse.json();
          throw new Error(errorData.error || "Failed to complete onchain transfer");
        }
      }

      setStep("complete");

      // Notify parent component of successful transfer and close modal
      setTimeout(() => {
        if (onTransferComplete) {
          onTransferComplete();
        }
        onClose(); // Close modal after showing success message
      }, 1500); // Give user time to see success message
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed");
      setStep("confirm"); // Return to confirm step on error
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (step !== "processing") {
      onClose();
    }
  };

  const renderSetupStep = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="source-federation">Source Federation</Label>
        <Select
          value={details.sourceFederation?.federation_id || ""}
          onValueChange={value => {
            const federation = allFederationsForSource.find(f => f.federation_id === value);
            setDetails(prev => ({
              ...prev,
              sourceFederation: federation || null,
              destinationFederation: null, // Reset destination when source changes
              amount: "",
              useMaxAmount: false,
              transactionChannel: TransactionChannel.Lightning, // Reset to default
            }));
            setError(null);
          }}
        >
          <SelectTrigger id="source-federation">
            <SelectValue placeholder="Select a federation to transfer from" />
          </SelectTrigger>
          <SelectContent>
            {allFederationsForSource.map(federation => (
              <SelectItem
                key={federation.federation_id}
                value={federation.federation_id}
                disabled={federation.balance_msat === 0}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={federation.balance_msat === 0 ? "text-muted-foreground" : ""}>
                    {getFederationName(federation)}
                  </span>
                  <span className="ml-2 text-sm text-muted-foreground">
                    {formatSats(federation.balance_msat)} sats
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {allFederationsForSource.length === 0 && (
          <p className="text-sm text-muted-foreground">No federations available</p>
        )}
      </div>

      {details.sourceFederation && (
        <div className="space-y-2">
          <Label htmlFor="destination-federation">Destination Federation</Label>
          <Select
            value={details.destinationFederation?.federation_id || ""}
            onValueChange={value => {
              const federation = destinationFederations.find(f => f.federation_id === value);
              setDetails(prev => ({
                ...prev,
                destinationFederation: federation || null,
              }));
              setError(null);
            }}
          >
            <SelectTrigger id="destination-federation">
              <SelectValue placeholder="Select destination federation" />
            </SelectTrigger>
            <SelectContent>
              {destinationFederations.map(federation => (
                <SelectItem key={federation.federation_id} value={federation.federation_id}>
                  {getFederationName(federation)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {destinationFederations.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No destination federations available on the{" "}
              {details.sourceFederation.config.global.network} network
            </p>
          )}
        </div>
      )}

      {details.sourceFederation && details.destinationFederation && (
        <div className="space-y-3">
          <Label htmlFor="transaction-channel">Transaction Channel</Label>
          <div className="space-y-2">
            {getAvailableChannels().length > 1 ? (
              <Select
                value={details.transactionChannel}
                onValueChange={(value: TransactionChannel) => {
                  setDetails(prev => ({
                    ...prev,
                    transactionChannel: value,
                  }));
                }}
              >
                <SelectTrigger id="transaction-channel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableChannels().includes(TransactionChannel.Lightning) && (
                    <SelectItem value={TransactionChannel.Lightning}>
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        <div>
                          <div className="font-medium">Lightning Network</div>
                          <div className="text-xs text-muted-foreground">Fast, low fees</div>
                        </div>
                      </div>
                    </SelectItem>
                  )}
                  <SelectItem value={TransactionChannel.Bitcoin}>
                    <div className="flex items-center gap-2">
                      <Bitcoin className="w-4 h-4" />
                      <div>
                        <div className="font-medium">Bitcoin On-chain</div>
                        <div className="text-xs text-muted-foreground">
                          More secure, higher fees
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                {details.transactionChannel === TransactionChannel.Lightning ? (
                  <>
                    <Zap className="w-4 h-4" />
                    <div>
                      <div className="font-medium">Lightning Network</div>
                      <div className="text-xs text-muted-foreground">
                        Both federations have gateways
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <Bitcoin className="w-4 h-4" />
                    <div>
                      <div className="font-medium">Bitcoin On-chain</div>
                      <div className="text-xs text-muted-foreground">
                        {(details.sourceFederation.gatewayCount ?? 0) === 0 ||
                        (details.destinationFederation.gatewayCount ?? 0) === 0
                          ? "Lightning not available - missing gateways"
                          : "On-chain transfer"}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {details.sourceFederation && details.destinationFederation && (
        <div className="space-y-3">
          <Label htmlFor="amount">Transfer Amount (sats)</Label>
          <div className="flex space-x-2">
            <Input
              id="amount"
              type="number"
              placeholder="Enter amount in sats"
              value={details.amount}
              onChange={e => handleAmountChange(e.target.value)}
              disabled={details.useMaxAmount}
              min="1"
              max={getMaxTransferSats()}
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleSetMaxAmount}
              className="shrink-0"
            >
              Max ({formatSats(details.sourceFederation.balance_msat)})
            </Button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );

  const renderConfirmStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Confirm Transfer</h3>
        <p className="text-muted-foreground">
          Please review the transfer details before proceeding.
        </p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">From</span>
            <span className="font-medium">{getFederationName(details.sourceFederation!)}</span>
          </div>

          <div className="flex items-center justify-center">
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">To</span>
            <span className="font-medium">{getFederationName(details.destinationFederation!)}</span>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Amount</span>
              <div className="flex items-center space-x-2">
                <Coins className="w-4 h-4 text-muted-foreground" />
                <span className="font-bold text-lg">
                  {formatSats(getTransferAmount() * 1000)} sats
                </span>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Channel</span>
              <div className="flex items-center space-x-2">
                {details.transactionChannel === TransactionChannel.Lightning ? (
                  <>
                    <Zap className="w-4 h-4 text-yellow-500" />
                    <span className="font-medium">Lightning Network</span>
                  </>
                ) : (
                  <>
                    <Bitcoin className="w-4 h-4 text-orange-500" />
                    <span className="font-medium">Bitcoin On-chain</span>
                  </>
                )}
              </div>
            </div>
            {details.transactionChannel === TransactionChannel.Lightning ? (
              <div className="text-xs text-muted-foreground mt-1">
                Fast transfer via Lightning invoice
              </div>
            ) : (
              <div className="text-xs text-muted-foreground mt-1">
                Secure transfer via Bitcoin address
              </div>
            )}
          </div>

          <div className="text-xs text-muted-foreground pt-2">
            Remaining balance:{" "}
            {formatSats(details.sourceFederation!.balance_msat - getTransferAmount() * 1000)} sats
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderProcessingStep = () => (
    <div className="text-center space-y-4">
      <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
      <h3 className="text-lg font-semibold">Processing Transfer</h3>
      <p className="text-muted-foreground">
        Transferring {formatSats(getTransferAmount() * 1000)} sats between federations...
      </p>
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}
    </div>
  );

  const renderCompleteStep = () => (
    <div className="text-center space-y-4">
      <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
      <h3 className="text-lg font-semibold">Transfer Complete</h3>
      <p className="text-muted-foreground">
        Successfully transferred {formatSats(getTransferAmount() * 1000)} sats from{" "}
        {getFederationName(details.sourceFederation!)} to{" "}
        {getFederationName(details.destinationFederation!)}.
      </p>
    </div>
  );

  const getStepContent = () => {
    switch (step) {
      case "setup":
        return renderSetupStep();
      case "confirm":
        return renderConfirmStep();
      case "processing":
        return renderProcessingStep();
      case "complete":
        return renderCompleteStep();
    }
  };

  const getFooterButtons = () => {
    switch (step) {
      case "setup":
        return (
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (validateAmount()) {
                  setStep("confirm");
                }
              }}
              disabled={!canProceedToConfirm()}
            >
              Continue
            </Button>
          </DialogFooter>
        );
      case "confirm":
        return (
          <DialogFooter>
            <Button variant="outline" onClick={() => setStep("setup")}>
              Back
            </Button>
            <Button onClick={handleTransfer} disabled={loading}>
              {loading ? "Processing..." : "Confirm Transfer"}
            </Button>
          </DialogFooter>
        );
      case "processing":
        return null; // No buttons during processing
      case "complete":
        return (
          <DialogFooter>
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </DialogFooter>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === "setup" && "Transfer Funds"}
            {step === "confirm" && "Confirm Transfer"}
            {step === "processing" && "Processing Transfer"}
            {step === "complete" && "Transfer Complete"}
          </DialogTitle>
          <DialogDescription>
            {step === "setup" && "Transfer funds between your federations"}
            {step === "confirm" && "Review and confirm your transfer"}
            {step === "processing" && "Please wait while we process your transfer"}
            {step === "complete" && "Your transfer has been completed successfully"}
          </DialogDescription>
        </DialogHeader>

        {getStepContent()}
        {getFooterButtons()}
      </DialogContent>
    </Dialog>
  );
}
