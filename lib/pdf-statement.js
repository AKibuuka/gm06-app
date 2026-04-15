import React from "react";
import { Document, Page, View, Text, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  header: { textAlign: "center", marginBottom: 20 },
  clubName: { fontSize: 16, fontWeight: "bold", color: "#0d9488" },
  subtitle: { fontSize: 8, letterSpacing: 3, color: "#999", marginTop: 2 },
  date: { fontSize: 9, color: "#666", marginTop: 6 },
  section: { marginBottom: 15 },
  sectionTitle: { fontSize: 11, fontWeight: "bold", marginBottom: 6, color: "#0d9488", borderBottomWidth: 1, borderBottomColor: "#0d9488", paddingBottom: 3 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  label: { color: "#666", fontSize: 9 },
  value: { fontWeight: "bold", fontSize: 10 },
  valueGreen: { fontWeight: "bold", fontSize: 10, color: "#16a34a" },
  valueRed: { fontWeight: "bold", fontSize: 10, color: "#dc2626" },
  table: { marginTop: 4 },
  tableHeader: { flexDirection: "row", borderBottomWidth: 2, borderBottomColor: "#0d9488", paddingBottom: 4, marginBottom: 4 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#eee", paddingVertical: 3 },
  tableRowBold: { flexDirection: "row", borderTopWidth: 2, borderTopColor: "#0d9488", paddingTop: 4, marginTop: 2 },
  col1: { flex: 2, fontSize: 9 },
  col2: { flex: 1, textAlign: "right", fontSize: 9 },
  col3: { flex: 0.5, textAlign: "right", fontSize: 9 },
  headerCol: { fontWeight: "bold", fontSize: 8, color: "#0d9488" },
  highlight: { backgroundColor: "#f0fdfa", padding: 10, borderRadius: 4, textAlign: "center", marginTop: 10 },
  highlightText: { fontSize: 11, fontWeight: "bold", color: "#0d9488" },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, textAlign: "center" },
  footerText: { fontSize: 7, color: "#999" },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", backgroundColor: "#f0fdfa", borderRadius: 6, padding: 12, marginBottom: 12 },
  infoItem: { width: "50%", marginBottom: 6 },
});

function fmtUGX(n) {
  if (n == null || isNaN(n)) return "-";
  return `USh${Math.round(n).toLocaleString()}`;
}

function fmtDate(d) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

function StatementDocument({ data }) {
  const { member, snapshot, allocation, date, club } = data;
  if (!snapshot) return null;

  const totalGain = snapshot.portfolio_value - snapshot.total_invested;
  const returnPct = snapshot.total_invested > 0 ? ((totalGain / snapshot.total_invested) * 100).toFixed(1) : 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.date}>{fmtDate(date)}</Text>
          <Text style={styles.clubName}>{club.name}</Text>
          <Text style={styles.subtitle}>INVESTMENT CLUB</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Portfolio Holder</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.label}>Name</Text>
              <Text style={styles.value}>{member.name}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.label}>Monthly Contribution</Text>
              <Text style={styles.value}>{fmtUGX(member.monthly_contribution)}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.label}>Portfolio Value</Text>
              <Text style={styles.value}>{fmtUGX(snapshot.portfolio_value)}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.label}>Total Gain</Text>
              <Text style={totalGain >= 0 ? styles.valueGreen : styles.valueRed}>{fmtUGX(totalGain)}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.label}>Total Invested</Text>
              <Text style={styles.value}>{fmtUGX(snapshot.total_invested)}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.label}>Total Return</Text>
              <Text style={totalGain >= 0 ? styles.valueGreen : styles.valueRed}>{returnPct}%</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Portfolio Holdings</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.col1, styles.headerCol]}>Asset Class</Text>
              <Text style={[styles.col2, styles.headerCol]}>Value (UGX)</Text>
              <Text style={[styles.col3, styles.headerCol]}>%</Text>
            </View>
            {(allocation || []).map((a, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.col1}>{a.asset}</Text>
                <Text style={styles.col2}>{a.value > 0 ? Math.round(a.value).toLocaleString() : "-"}</Text>
                <Text style={styles.col3}>{a.pct > 0 ? `${a.pct}%` : "0.0%"}</Text>
              </View>
            ))}
            <View style={styles.tableRowBold}>
              <Text style={[styles.col1, { fontWeight: "bold" }]}>Total</Text>
              <Text style={[styles.col2, { fontWeight: "bold" }]}>{Math.round(snapshot.portfolio_value).toLocaleString()}</Text>
              <Text style={[styles.col3, { fontWeight: "bold" }]}>100%</Text>
            </View>
          </View>
        </View>

        <View style={styles.highlight}>
          <Text style={styles.label}>Advance Contribution</Text>
          <Text style={styles.highlightText}>{fmtUGX(snapshot.advance_contribution)}</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Generated on {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}</Text>
          <Text style={styles.footerText}>For queries, contact the Treasurer at greenminds06investmentclub@gmail.com</Text>
          <Text style={[styles.footerText, { marginTop: 2 }]}>Valuations may include unrealised profits/losses.</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function generateStatementPDF(statementData) {
  return renderToBuffer(<StatementDocument data={statementData} />);
}
