import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  SafeAreaView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import EmojiPicker from 'rn-emoji-keyboard';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../context/AuthContext';
import { useTeam } from '../context/TeamContext';
import { useCustomAlert } from '../hooks/useCustomAlert';
import { CustomCategoryService } from '../services/CustomCategoryService';

interface CreateCustomCategoryRouteParams {
  onCategoryCreated?: (categoryName: string) => void;
}

export const CreateCustomCategoryScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { accountHolderId } = useTeam();
  const { showError, showSuccess } = useCustomAlert();

  const { onCategoryCreated } = (route.params as CreateCustomCategoryRouteParams) || {};

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryIcon, setNewCategoryIcon] = useState("📁");
  const [isLoading, setIsLoading] = useState(false);
  const [showEmojiSelector, setShowEmojiSelector] = useState(false);
  const [lastCustomEmoji, setLastCustomEmoji] = useState<string>("");

  const handleCreateCustomCategory = async () => {
    if (!user || !accountHolderId) return;

    const validation = CustomCategoryService.validateCategoryName(newCategoryName);
    if (!validation.isValid) {
      showError("Error", validation.error as string);
      return;
    }

    setIsLoading(true);
    try {
      const newCategory = await CustomCategoryService.createCustomCategory(
        accountHolderId,
        user.uid,
        newCategoryName,
        newCategoryIcon
      );

      if (newCategory) {
        showSuccess(
          "Category Created",
          `Successfully created "${newCategoryName}" category.`,
          {
            onPrimaryPress: () => {
              // Call the callback if provided (for CategoryPicker)
              if (onCategoryCreated) {
                onCategoryCreated(newCategory.name);
              }
              navigation.goBack();
            },
          }
        );
      } else {
        showError(
          "Error",
          "Failed to create custom category. It may already exist."
        );
      }
    } catch (error) {
      console.error("Error creating custom category:", error);
      showError(
        "Error",
        "Failed to create custom category. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]}>
      {/* Custom Header */}
      <View style={[styles.header, { borderBottomColor: theme.border.primary }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color={theme.text.primary} />
          <Text style={[styles.backButtonText, { color: theme.text.primary }]}>Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter} />
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Info Card */}
        <View style={[styles.infoCard, { backgroundColor: theme.background.secondary }]}>
          <View style={[styles.infoIcon, { backgroundColor: theme.gold.primary + '20' }]}>
            <Ionicons name="folder" size={24} color={theme.gold.primary} />
          </View>
          <Text style={[styles.infoTitle, { color: theme.text.primary }]}>
            Custom Categories
          </Text>
          <Text style={[styles.infoDescription, { color: theme.text.secondary }]}>
            Create custom categories to organize your receipts exactly how you want. 
            You can use any emoji or leave it blank for a clean look.
          </Text>
        </View>

        {/* Category Name Input */}
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: theme.text.primary }]}>
            Category Name *
          </Text>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: theme.background.secondary,
                borderColor: theme.border.primary,
                color: theme.text.primary,
              },
            ]}
            placeholder="Enter category name..."
            placeholderTextColor={theme.text.tertiary}
            value={newCategoryName}
            onChangeText={setNewCategoryName}
            maxLength={30}
            autoCapitalize="words"
          />
          <Text style={[styles.characterCount, { color: theme.text.tertiary }]}>
            {newCategoryName.length}/30
          </Text>
        </View>

        {/* Icon Selection */}
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: theme.text.primary }]}>
            Icon
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.iconPicker}
          >
            {/* Custom emoji selector option */}
            <TouchableOpacity
              style={[
                styles.iconOption,
                styles.addEmojiOption,
                { borderColor: theme.border.primary },
                showEmojiSelector && {
                  borderColor: theme.gold.primary,
                  backgroundColor: theme.gold.primary + "20",
                },
              ]}
              onPress={() => setShowEmojiSelector(true)}
            >
              <Ionicons 
                name="add" 
                size={20} 
                color={showEmojiSelector ? theme.gold.primary : theme.text.secondary} 
              />
            </TouchableOpacity>

            {/* No emoji option */}
            <TouchableOpacity
              style={[
                styles.iconOption,
                styles.noEmojiOption,
                { borderColor: theme.border.primary },
                newCategoryIcon === "" && {
                  borderColor: theme.gold.primary,
                  backgroundColor: theme.gold.primary + "20",
                },
              ]}
              onPress={() => {
                setNewCategoryIcon("");
                setShowEmojiSelector(false);
              }}
            >
              <Ionicons 
                name="ban" 
                size={16} 
                color={newCategoryIcon === "" ? theme.gold.primary : theme.text.secondary} 
              />
            </TouchableOpacity>

            {/* Custom emoji preview */}
            {lastCustomEmoji && (
              <TouchableOpacity
                style={[
                  styles.iconOption,
                  styles.selectedEmojiPreview,
                  {
                    borderColor: newCategoryIcon === lastCustomEmoji ? theme.gold.primary : theme.border.primary,
                    backgroundColor: newCategoryIcon === lastCustomEmoji ? theme.gold.primary + "20" : "transparent",
                  },
                ]}
                onPress={() => {
                  setNewCategoryIcon(lastCustomEmoji);
                  setShowEmojiSelector(false);
                }}
              >
                <Text style={styles.iconText}>{lastCustomEmoji}</Text>
              </TouchableOpacity>
            )}
            
            {/* Default icons */}
            {CustomCategoryService.getDefaultIcons().map((icon, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.iconOption,
                  { borderColor: theme.border.primary },
                  newCategoryIcon === icon && {
                    borderColor: theme.gold.primary,
                    backgroundColor: theme.gold.primary + "20",
                  },
                ]}
                onPress={() => {
                  setNewCategoryIcon(icon);
                  setShowEmojiSelector(false);
                }}
              >
                <Text style={styles.iconText}>{icon}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Create Button */}
        <TouchableOpacity
          style={[
            styles.createButton,
            {
              backgroundColor: isLoading || !newCategoryName.trim() ? theme.gold.primary + '60' : theme.gold.primary,
            },
          ]}
          onPress={handleCreateCustomCategory}
          disabled={isLoading || !newCategoryName.trim()}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.createButtonText}>Create Category</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Emoji Keyboard */}
      {showEmojiSelector && (
        <View style={styles.emojiPickerContainer}>
          <EmojiPicker
            onEmojiSelected={(emojiObject) => {
              setNewCategoryIcon(emojiObject.emoji);
              // Only track as custom emoji if it's not in default icons
              if (!CustomCategoryService.getDefaultIcons().includes(emojiObject.emoji)) {
                setLastCustomEmoji(emojiObject.emoji);
              }
              setShowEmojiSelector(false);
            }}
            open={true}
            onClose={() => setShowEmojiSelector(false)}
            theme={{
              backdrop: theme.background.overlay || 'rgba(0, 0, 0, 0.5)',
              knob: theme.border.primary,
              container: theme.background.primary,
              header: theme.background.secondary,
              category: {
                icon: theme.text.secondary,
                iconActive: theme.gold.primary,
                container: theme.background.secondary,
                containerActive: theme.gold.primary + '20',
              },
              search: {
                text: theme.text.primary,
                placeholder: theme.text.tertiary,
                icon: theme.text.secondary,
                background: theme.background.secondary,
              },
              emoji: {
                selected: theme.gold.primary + '40',
              },
            }}
            enableSearchBar={true}
            enableRecentlyUsed={true}
            categoryPosition="top"
          />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    marginLeft: -8,
  },
  backButtonText: {
    fontSize: 17,
    marginLeft: 4,
  },
  headerCenter: {
    flex: 1,
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  infoCard: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 20,
  },
  infoIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  infoDescription: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 4,
  },
  characterCount: {
    fontSize: 12,
    textAlign: 'right',
  },
  iconPicker: {
    paddingVertical: 8,
  },
  iconOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 20,
  },
  addEmojiOption: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  noEmojiOption: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedEmojiPreview: {
    borderWidth: 2,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    gap: 8,
    marginTop: 20,
    marginBottom: 40,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emojiPickerContainer: {
    zIndex: 9999,
    elevation: 9999,
  },
});

export default CreateCustomCategoryScreen;