import React, { useState } from 'react';
import { WebView } from 'react-native-webview';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
  Text,
} from 'react-native';

export default function App() {
  const serverUrl = 'http://172.17.4.244:5000';
  const [error, setError] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0e1a" />
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            Could not connect to server.{'\n'}
            Make sure the Node.js app is running and your phone is on the same WiFi.
          </Text>
        </View>
      ) : (
        <WebView
          source={{ uri: serverUrl }}
          style={styles.webview}
          originWhitelist={['*']}
          mixedContentMode="always"
          domStorageEnabled={true}
          allowFileAccess={true}
          onError={() => setError(true)}
          onHttpError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            // You can optionally check nativeEvent.statusCode if needed
            setError(true);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e1a',
  },
  webview: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
});

