import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { repo } from '@/db/repo';
import type { ReadingDay } from '@/db/types';
import {
  computeStreaks,
  dayKey,
  formatDuration,
  keyToDate,
  lastNDays,
  type Streaks,
} from '@/stats/streaks';
import { FONT, useAppColors, type AppColors } from '@/ui/app-theme';

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const CHART_BAR_MAX = 72;

interface Stats {
  streaks: Streaks;
  todaySeconds: number;
  totalSeconds: number;
  activeDayCount: number;
  wordCount: number;
  booksFinished: number;
  /** last 7 days, ascending, zero-filled */
  week: { key: string; seconds: number }[];
}

function buildStats(days: ReadingDay[], wordCount: number, booksFinished: number): Stats {
  const byDate = new Map(days.map((day) => [day.date, day.seconds]));
  const today = dayKey();
  return {
    streaks: computeStreaks(days, today),
    todaySeconds: byDate.get(today) ?? 0,
    totalSeconds: days.reduce((sum, day) => sum + day.seconds, 0),
    activeDayCount: days.filter((day) => day.seconds > 0).length,
    wordCount,
    booksFinished,
    week: lastNDays(7, today).map((key) => ({ key, seconds: byDate.get(key) ?? 0 })),
  };
}

/** My Progress — reading streak, weekly activity, lifetime totals. */
export default function ProgressScreen() {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<Stats | null>(null);

  const reload = useCallback(() => {
    Promise.all([repo.listReadingDays(), repo.listVocab(), repo.listBooks()])
      .then(([days, vocab, books]) =>
        setStats(
          buildStats(days, vocab.length, books.filter((book) => book.progress >= 0.99).length),
        ),
      )
      .catch(() => setStats(buildStats([], 0, 0)));
  }, []);
  useFocusEffect(reload);

  if (!stats) return null;

  const { streaks } = stats;
  const onStreak = streaks.current > 0;
  const maxWeekSeconds = Math.max(...stats.week.map((day) => day.seconds), 1);
  const todayKeyValue = dayKey();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
    >
      {/* streak hero */}
      <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={styles.heroEmoji}>{onStreak ? '🔥' : '🌱'}</Text>
        <Text style={[styles.heroNumber, { color: colors.text }]}>{streaks.current}</Text>
        <Text style={[styles.heroLabel, { color: colors.subtle }]}>
          {streaks.current === 1 ? 'day streak' : 'day streak'}
        </Text>
        <Text style={[styles.heroHint, { color: colors.subtle }]}>
          {onStreak
            ? `Best ever: ${streaks.best} ${streaks.best === 1 ? 'day' : 'days'} — keep it going!`
            : 'Read a little today to start your streak!'}
        </Text>
      </View>

      {/* last 7 days */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>This week</Text>
          <Text style={[styles.cardAside, { color: colors.subtle }]}>
            Today: {formatDuration(stats.todaySeconds)}
          </Text>
        </View>
        <View style={styles.chart}>
          {stats.week.map(({ key, seconds }) => {
            const isToday = key === todayKeyValue;
            const height =
              seconds > 0 ? Math.max(10, (seconds / maxWeekSeconds) * CHART_BAR_MAX) : 4;
            return (
              <View key={key} style={styles.chartColumn}>
                <View
                  style={[
                    styles.chartBar,
                    {
                      height,
                      backgroundColor:
                        seconds > 0 ? (isToday ? colors.accent : colors.secondary) : colors.border,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.chartDay,
                    { color: isToday ? colors.accent : colors.subtle },
                    isToday && { fontFamily: FONT.heading },
                  ]}
                >
                  {WEEKDAY_LETTERS[keyToDate(key).getDay()]}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* lifetime totals */}
      <View style={styles.grid}>
        <StatTile emoji="⏱️" value={formatDuration(stats.totalSeconds)} label="time read" colors={colors} />
        <StatTile emoji="⭐" value={String(stats.wordCount)} label="words collected" colors={colors} />
        <StatTile emoji="🏆" value={String(stats.booksFinished)} label="books finished" colors={colors} />
        <StatTile emoji="📅" value={String(stats.activeDayCount)} label="reading days" colors={colors} />
      </View>

      <Text style={[styles.footer, { color: colors.subtle }]}>
        Time counts while a book is open and the app is in front of you.
      </Text>
    </ScrollView>
  );
}

function StatTile({
  emoji,
  value,
  label,
  colors,
}: {
  emoji: string;
  value: string;
  label: string;
  colors: AppColors;
}) {
  return (
    <View style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={styles.tileEmoji}>{emoji}</Text>
      <Text style={[styles.tileValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.tileLabel, { color: colors.subtle }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 12,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  hero: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 24,
    paddingHorizontal: 20,
    gap: 2,
    boxShadow: '0 6px 18px rgba(59, 48, 73, 0.07)',
  },
  heroEmoji: {
    fontSize: 40,
  },
  heroNumber: {
    fontSize: 52,
    fontFamily: FONT.heading,
    lineHeight: 58,
  },
  heroLabel: {
    fontSize: 15,
    fontFamily: FONT.bold,
  },
  heroHint: {
    fontSize: 13,
    fontFamily: FONT.semibold,
    marginTop: 8,
    textAlign: 'center',
  },
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    boxShadow: '0 4px 14px rgba(59, 48, 73, 0.06)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: FONT.heading,
  },
  cardAside: {
    fontSize: 13,
    fontFamily: FONT.semibold,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: CHART_BAR_MAX + 26,
  },
  chartColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  chartBar: {
    width: 18,
    borderRadius: 9,
  },
  chartDay: {
    fontSize: 12,
    fontFamily: FONT.semibold,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tile: {
    flexBasis: '45%',
    flexGrow: 1,
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 16,
    gap: 2,
    boxShadow: '0 4px 14px rgba(59, 48, 73, 0.06)',
  },
  tileEmoji: {
    fontSize: 24,
  },
  tileValue: {
    fontSize: 20,
    fontFamily: FONT.heading,
  },
  tileLabel: {
    fontSize: 12,
    fontFamily: FONT.semibold,
  },
  footer: {
    fontSize: 12,
    fontFamily: FONT.semibold,
    textAlign: 'center',
    marginTop: 4,
  },
});
