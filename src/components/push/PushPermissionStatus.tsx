"use client";

import { useEffect, useState } from "react";
import { BellIcon } from "@/components/icons";
import { AppDownloadBanner } from "@/components/notifications/AppDownloadBanner";
import { Button, Card, CardBody } from "@/components/ui";
import {
  getPushPermissionState,
  requestPushPermissionAndRegister,
  type PushPermissionState,
} from "@/lib/push/permission";

/** Account-page status + control for push notifications — the only place besides PriceTrackingCta's first-tracking-start prompt that can turn permission on, for a user who wants to opt in proactively instead of waiting. */
export function PushPermissionStatus() {
  const [state, setState] = useState<PushPermissionState | null>(null);

  useEffect(() => {
    void getPushPermissionState().then(setState);
  }, []);

  // Null until the native check resolves — avoids a wrong-then-right flash.
  if (state === null) return null;

  return (
    <Card>
      <CardBody>
        <span className="flex items-center gap-1.5 text-small font-semibold text-ink">
          <BellIcon width={16} height={16} />
          알림
        </span>

        {state === "unavailable" && (
          <>
            <p className="text-small text-ink-muted">앱에서만 켤 수 있는 기능이에요.</p>
            <AppDownloadBanner />
          </>
        )}

        {state === "granted" && <p className="text-small text-ink-muted">알림이 켜져 있어요.</p>}

        {state === "denied" && (
          <p className="text-small text-ink-muted">
            알림이 꺼져 있어요. 기기 설정 &gt; 앱 &gt; HOTELow &gt; 알림에서 허용할 수 있어요.
          </p>
        )}

        {state === "prompt" && (
          <>
            <p className="text-small text-ink-muted">
              아직 꺼져 있어요. 켜두면 가격이 내려갈 때 바로 알려드려요.
            </p>
            <Button
              size="sm"
              onClick={async () => {
                await requestPushPermissionAndRegister();
                setState(await getPushPermissionState());
              }}
            >
              알림 켜기
            </Button>
          </>
        )}
      </CardBody>
    </Card>
  );
}
