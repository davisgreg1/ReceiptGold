import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CollapsibleFilterSectionProps {
  title: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
  headerStyle?: object;
  contentStyle?: object;
  titleStyle?: object;
  iconColor?: string;
  headerBackgroundColor?: string;
  contentBackgroundColor?: string;
  titleColor?: string;
  shadowColor?: string;
}

const CollapsibleFilterSection: React.FC<CollapsibleFilterSectionProps> = ({
  title,
  defaultExpanded = false,
  children,
  headerStyle,
  contentStyle,
  titleStyle,
  iconColor = '#007AFF',
  headerBackgroundColor = '#F8F9FA',
  contentBackgroundColor = '#FFFFFF',
  titleColor = '#333333',
  shadowColor = '#000',
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const toggleSection = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <View style={[
      styles.container, 
      { 
        backgroundColor: contentBackgroundColor,
        shadowColor: shadowColor,
        borderColor: shadowColor + '20', // Add subtle border for better definition in dark mode
        borderWidth: 0.5,
      }
    ]}>
      <TouchableOpacity 
        style={[
          styles.header, 
          { backgroundColor: headerBackgroundColor },
          headerStyle
        ]} 
        onPress={toggleSection}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.headerText, 
          { color: titleColor },
          titleStyle
        ]}>
          {title}
        </Text>
        <Ionicons 
          name={isExpanded ? "chevron-up" : "chevron-down"} 
          size={20} 
          color={iconColor}
          style={styles.chevron}
        />
      </TouchableOpacity>
      
      {isExpanded && (
        <View style={[
          styles.content, 
          { backgroundColor: contentBackgroundColor },
          contentStyle
        ]}>
          {children}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    borderRadius: 8,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  chevron: {
    marginLeft: 8,
  },
  content: {
    padding: 16,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
});

export default CollapsibleFilterSection;
