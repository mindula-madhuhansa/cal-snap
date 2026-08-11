import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { useAccount } from '@/account/session';
import { createSupabaseClient } from '@/account/supabase';
import { createSupabaseScanTransport } from '@/account/supabase-scan-transport';
import { useAuth } from '@clerk/expo';
import { AppText } from '@/design-system/components/app-text';
import { Button } from '@/design-system/components/button';
import { Callout } from '@/design-system/components/callout';
import { ErrorState } from '@/design-system/components/error-state';
import { LoadingState } from '@/design-system/components/loading-state';
import { Screen } from '@/design-system/components/screen';
import { haptics } from '@/design-system/haptics';
import { colors, radii, space } from '@/design-system/theme';

import { CAMERA_BLOCKED_BODY, CAMERA_BLOCKED_TITLE } from './messages';
import { ScanResultView } from './scan-result-view';
import { useScan } from './use-scan';

/**
 * Snap a meal (spec 0007).
 *
 * The one screen this feature has, drawing the state machine in `use-scan.ts`.
 * It owns the two effects the machine deliberately does not: the camera
 * permission, and getting a photo out of the camera or the library.
 *
 * **No tap is ever silently ignored** (AC-5). A refused permission gets a
 * screen that explains why the camera is needed, a control that opens this
 * app's page in the system settings, and the library as a second way through.
 */

/** AC-4. Both ways in reach the same scan and the same result screen. */
const LIBRARY_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsMultipleSelection: false,
  // The scan reads the whole plate, so nothing is cropped away here. The
  // shrinking happens once, in `preparePhoto`, at the size AC-16 fixes.
  allowsEditing: false,
  quality: 1,
};

export const CaptureScreen = () => {
  const account = useAccount();
  const { getToken } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);

  const transport = useMemo(
    () => createSupabaseScanTransport(createSupabaseClient((...args) => getToken(...args))),
    // `getToken` is a new function on every render, so depending on it would
    // rebuild the client every time. The one built on the first render reads
    // the current token per request anyway (`src/account/AGENTS.md`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const ready = account.kind === 'ready' ? account : undefined;

  const scan = useScan({
    transport,
    // The hook needs a handle before the account settles; the screen below
    // renders a loading state until it does, so nothing reaches the database.
    db: ready?.db as never,
    userId: ready?.userId ?? '',
  });

  const { setBlocked } = scan;

  // Asked once, on arrival, rather than behind the shutter: a person who has
  // just pressed a tab should find out now whether this screen can work.
  useEffect(() => {
    if (permission === null) return;
    if (permission.granted) return;

    if (permission.canAskAgain) {
      void requestPermission();
      return;
    }

    // Refused before, and the system will not ask again. Only Settings can
    // change it now, so the screen says so instead of asking into the void.
    setBlocked();
  }, [permission, requestPermission, setBlocked]);

  const takePhoto = useCallback((): void => {
    void (async () => {
      haptics.selection();
      const picture = await camera.current?.takePictureAsync({ quality: 1 });
      if (picture === undefined) return;
      scan.scanPhoto({ uri: picture.uri, width: picture.width, height: picture.height });
    })();
  }, [scan]);

  const pickFromLibrary = useCallback((): void => {
    void (async () => {
      const picked = await ImagePicker.launchImageLibraryAsync(LIBRARY_OPTIONS);
      const asset = picked.canceled ? undefined : picked.assets[0];
      if (asset === undefined) return;
      scan.scanPhoto({ uri: asset.uri, width: asset.width, height: asset.height });
    })();
  }, [scan]);

  if (ready === undefined) {
    return (
      <Screen>
        <LoadingState message="Getting your diary ready" />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppText variant="h1" heading>
        Snap a meal
      </AppText>

      {scan.state.kind === 'blocked' ? (
        // AC-5. Explain, offer Settings, and keep the library open.
        <View style={styles.stack}>
          <ErrorState
            title={CAMERA_BLOCKED_TITLE}
            body={CAMERA_BLOCKED_BODY}
            onRetry={() => void Linking.openSettings()}
            retryLabel="Open Settings"
          />
          <Button
            label="Pick from library"
            variant="secondary"
            onPress={pickFromLibrary}
            fullWidth
          />
        </View>
      ) : undefined}

      {scan.state.kind === 'idle' && permission?.granted === true ? (
        <View style={styles.stack}>
          <View style={styles.viewport}>
            <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" />
          </View>

          <Callout message="Fill the frame with the plate, from above, in even light. Better photos read better." />

          <Button
            label="Scan this meal"
            icon="camera"
            size="block"
            onPress={takePhoto}
            fullWidth
            accessibilityHint="Takes a photo and reads its nutrition"
            testID="scan-shutter"
          />
          <Button
            label="Pick from library"
            variant="secondary"
            onPress={pickFromLibrary}
            fullWidth
            testID="scan-library"
          />
        </View>
      ) : undefined}

      {scan.state.kind === 'preparing' ? (
        <LoadingState message="Getting the photo ready" />
      ) : undefined}

      {/* AC-12. Same screen, different words: the wait reads as slow rather
          than stuck, and nothing is cancelled underneath it. */}
      {scan.state.kind === 'scanning' ? (
        <LoadingState
          message={
            scan.state.slow
              ? 'This is taking longer than usual. Still working, so hold on.'
              : 'Reading your meal'
          }
        />
      ) : undefined}

      {scan.state.kind === 'result' ? (
        <ScanResultView
          result={scan.state.result}
          onRetake={scan.reset}
          onRetry={scan.retry}
          onPickFromLibrary={pickFromLibrary}
        />
      ) : undefined}
    </Screen>
  );
};

const styles = StyleSheet.create({
  stack: {
    gap: space[4],
  },
  viewport: {
    // A 3:4 window rather than a full bleed camera, so the screen keeps the
    // design's gutter and the shutter is never under the system chrome.
    aspectRatio: 3 / 4,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
});
