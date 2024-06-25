/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React from "react";
import { Button, SafeAreaView } from "react-native";
import {
  createWebView,
  type BridgeWebView,
  bridge,
  postMessageSchema,
} from "@webview-bridge/react-native";
import InAppBrowser from "react-native-inappbrowser-reborn";
import { z } from "zod";
import * as yup from "yup";
import * as superstruct from "superstruct";
export const appBridge = bridge({
  async getMessage() {
    return "I'm from native" as const;
  },
  async openInAppBrowser(url: string) {
    if (await InAppBrowser.isAvailable()) {
      await InAppBrowser.open(url);
    }
  },
});

const appSchema = postMessageSchema({
  setWebMessage_zod: z.string(),
  setWebMessage_yup: yup.string().required(),
  setWebMessage_superstruct: superstruct.string(),
});

// It is exported via the package.json type field.
export type AppBridge = typeof appBridge;
export type AppPostMessageSchema = typeof appSchema;

export const { WebView, postMessage } = createWebView({
  bridge: appBridge,
  postMessageSchema: appSchema,
  debug: true,
  fallback: (method) => {
    console.warn(`Method '${method}' not found in native`);
  },
});

function App(): JSX.Element {
  const webviewRef = React.useRef<BridgeWebView>(null);

  return (
    <SafeAreaView style={{ height: "100%" }}>
      <WebView
        ref={webviewRef}
        source={{
          uri: "http://localhost:5173",
        }}
        style={{ height: "100%", flex: 1, width: "100%" }}
      />

      <Button
        title="setWebMessage (zod)"
        onPress={() => postMessage("setWebMessage_zod", "zod !")}
      />
      <Button
        title="setWebMessage (yup)"
        onPress={() => postMessage("setWebMessage_yup", "yup !")}
      />
      <Button
        title="setWebMessage (superstruct)"
        onPress={() =>
          postMessage("setWebMessage_superstruct", "superstruct !")
        }
      />
    </SafeAreaView>
  );
}

export default App;
