import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Minimal themed bottom sheet on RN Modal — shared by the reader's TOC,
 * appearance, selection, and notebook sheets.
 * Edge-to-edge aware: respects the bottom system-bar inset and avoids the
 * keyboard on BOTH platforms (Android is edge-to-edge since SDK 54, so it no
 * longer auto-resizes for the keyboard).
 */
export function BottomSheetModal({
  open,
  onClose,
  surfaceColor,
  children,
}: {
  open: boolean;
  onClose: () => void;
  surfaceColor: string;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      // statusBarTranslucent only: the backdrop may cover the status bar, but
      // the modal window must STOP above the Android navigation-button bar —
      // drawing behind it (navigationBarTranslucent) hides sheet content on
      // 3-button-nav devices, which report a bottom inset of 0.
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <KeyboardAvoidingView behavior="padding" style={styles.avoider} pointerEvents="box-none">
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: surfaceColor,
                paddingBottom: Math.max(24, insets.bottom + 16),
                // pixel cap: a %-maxHeight resolves against a content-sized
                // parent here, which the browser treats as "no limit"
                maxHeight: Math.round(windowHeight * 0.72),
              },
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            {children}
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#0006',
    justifyContent: 'flex-end',
  },
  avoider: {
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    overflow: 'hidden',
  },
});
