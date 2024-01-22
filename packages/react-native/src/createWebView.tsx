import { createEvents, createRandomId } from "@webview-bridge/util";
import {
  createRef,
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import React from "react";
import type { WebViewMessageEvent, WebViewProps } from "react-native-webview";
import WebView from "react-native-webview";
import type { z } from "zod";

import {
  handleBridge,
  handleLog,
  INTEGRATIONS_SCRIPTS_BRIDGE,
  INTEGRATIONS_SCRIPTS_CONSOLE,
  LogType,
} from "./integrations";
import { handleRegisterWebMethod } from "./integrations/handleRegisterWebMethod";
import { Bridge } from "./types/bridge";
import type { BridgeWebView } from "./types/webview";

export type CreateWebViewArgs<
  BridgeObject extends Bridge,
  ValidatePostMessage extends Record<string, z.AnyZodObject>,
> = {
  bridge: BridgeObject;
  debug?: boolean;
  responseTimeout?: number;
  fallback?: (method: keyof BridgeObject) => void;
  validatePostMessage?: ValidatePostMessage;
};

export type WebMethod<T> = T & {
  isReady: boolean;
};

export const createWebView = <
  BridgeObject extends Bridge,
  ValidatePostMessage extends Record<string, z.AnyZodObject>,
>({
  bridge,
  debug,
  responseTimeout = 2000,
  fallback,
}: CreateWebViewArgs<BridgeObject, ValidatePostMessage>) => {
  const WebMethod = {
    current: {
      isReady: false,
    },
  };

  const _webviewRef = createRef<BridgeWebView>();
  const emitter = createEvents();
  return {
    WebView: forwardRef<BridgeWebView, WebViewProps>((props, ref) => {
      const webviewRef = useRef<WebView>(null);

      const bridgeNames = useMemo(
        () =>
          Object.values(bridge ?? {}).map((func) => {
            return `'${func.name}'`;
          }),
        [],
      );

      useImperativeHandle(
        ref,
        () => {
          return webviewRef.current as BridgeWebView;
        },
        [],
      );

      useImperativeHandle(
        _webviewRef,
        () => {
          return webviewRef.current as BridgeWebView;
        },
        [],
      );

      const handleMessage = async (event: WebViewMessageEvent) => {
        props.onMessage?.(event);

        if (!webviewRef.current) {
          return;
        }
        const { type, body } = JSON.parse(event.nativeEvent.data);

        switch (type) {
          case "log": {
            const { method, args } = body as {
              method: LogType;
              args: unknown[];
            };
            debug && handleLog(method, args);
            return;
          }
          case "bridge": {
            const { method, args, eventId } = body as {
              method: string;
              args: unknown[];
              eventId: string;
            };

            handleBridge({
              bridge,
              method,
              args,
              eventId,
              webview: webviewRef.current,
            });
            return;
          }
          case "registerWebMethod": {
            const { bridgeNames } = body as {
              bridgeNames: string[];
            };
            Object.assign(
              WebMethod.current,
              handleRegisterWebMethod(
                emitter,
                webviewRef.current,
                bridgeNames,
                responseTimeout,
              ),
            );
            WebMethod.current.isReady = true;
            return;
          }
          case "webMethodResponse": {
            const { eventId, funcName, value } = body as {
              eventId: string;
              funcName: string;
              value: unknown;
            };

            emitter.emit(`${funcName}-${eventId}`, value);
            return;
          }
          case "webMethodError": {
            const { eventId, funcName } = body as {
              eventId: string;
              funcName: string;
              value: unknown;
            };

            emitter.emit(`${funcName}-${eventId}`, {}, true);
            return;
          }
          case "fallback": {
            const { method } = body as {
              method: keyof BridgeObject;
            };
            fallback?.(method);
            return;
          }
        }
      };

      return (
        <WebView
          {...props}
          ref={webviewRef}
          onMessage={handleMessage}
          injectedJavaScriptBeforeContentLoaded={[
            INTEGRATIONS_SCRIPTS_BRIDGE(bridgeNames),
            props.injectedJavaScriptBeforeContentLoaded,
            "true;",
          ]
            .filter(Boolean)
            .join("\n")}
          injectedJavaScript={[
            console && INTEGRATIONS_SCRIPTS_CONSOLE,
            props.injectedJavaScript,
            "true;",
          ]
            .filter(Boolean)
            .join("\n")}
        />
      );
    }),
    linkWebMethod<T>() {
      return WebMethod as {
        current: WebMethod<T>;
      };
    },
    postMessage(
      eventName: keyof ValidatePostMessage extends undefined
        ? string
        : keyof ValidatePostMessage,
      data: keyof ValidatePostMessage extends undefined
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          any
        : z.infer<ValidatePostMessage[keyof ValidatePostMessage]>,
    ) {
      if (!_webviewRef.current) {
        throw new Error("postMessage is not ready");
      }
      const eventId = createRandomId();
      return _webviewRef.current.injectJavaScript(`
        window.webEmitter.emit('${String(
          eventName,
        )}', '${eventId}', ${JSON.stringify(data)});

        true;
        `);
    },
  };
};
