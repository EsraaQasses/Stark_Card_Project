import React from "react";
import { View, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Verification from "../../src/screens/Verification";

class Boundary extends React.Component<{ children: React.ReactNode }, { err: any }> {
  state = { err: null as any };

  componentDidCatch(err: any) {
    this.setState({ err });
  }

  render() {
    if (this.state.err) {
      return (
        <View style={{ flex: 1, padding: 20, justifyContent: "center" }}>
          <Text style={{ fontWeight: "800", marginBottom: 8 }}>Crash in Verification:</Text>
          <Text>{String(this.state.err?.message || this.state.err)}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function VerificationRoute() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const name = String(params?.name || "");

  return (
    <Boundary>
      <Verification
        initialName={name}
        onVerified={() => router.replace("/(auth)/login")}
      />
    </Boundary>
  );
}
