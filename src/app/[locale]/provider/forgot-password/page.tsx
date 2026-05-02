"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowLeft, MessageCircle } from "lucide-react";
import PhoneInput from "@/components/PhoneInput";

const WHATSAPP_NUMBER =
  process.env.NEXT_PUBLIC_SHIZU_WHATSAPP || "2250700000000";

export default function ForgotPasswordPage() {
  const t = useTranslations("forgotPassword");
  const params = useParams();
  const locale = (params?.locale as string) ?? "fr";

  const [phone, setPhone] = useState("");

  const whatsappMessage = `Bonjour Shizu, je souhaite réinitialiser mon mot de passe. Mon numéro : ${phone || "..."}`;
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-1">
          <CardTitle className="text-2xl">{t("title")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">{t("phoneLabel")}</Label>
            <PhoneInput
              id="phone"
              defaultValue={phone}
              onChange={setPhone}
              selectClassName="rounded-l-md border-input bg-muted text-muted-foreground"
              inputClassName="rounded-r-md border-input"
            />
          </div>

          <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground text-center">
            {t("instruction")}
          </div>

          <Button asChild className="w-full gap-2 bg-green-600 hover:bg-green-700">
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" />
              {t("whatsAppButton")}
            </a>
          </Button>

          <a
            href={`/${locale}/provider/login`}
            className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            {t("back")}
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
