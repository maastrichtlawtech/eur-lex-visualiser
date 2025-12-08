export function SEO({ 
  title, 
  description, 
  keywords, 
  canonical,
  type = 'website',
  image = '/preview.png'
}) {
  const siteTitle = 'LegalViz.EU';
  const fullTitle = title ? `${title} | ${siteTitle}` : siteTitle;
  const metaDescription = description || 'Interactive visualisation of EU laws (e.g.GDPR, AI Act, DMA, DSA, Data Act). Navigate articles, recitals, and annexes with ease.';
  const metaKeywords = keywords || 'EU law, GDPR, AI Act, DMA, DSA, Data Act, visualisation, legal tech, interactive law';
  const siteUrl = 'https://legalviz.eu'; // Replace with actual domain if different
  const currentUrl = canonical || (typeof window !== 'undefined' ? window.location.href : siteUrl);
  const imageUrl = image.startsWith('http') ? image : `${siteUrl}${image}`;

  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={metaDescription} />
      <meta name="keywords" content={metaKeywords} />
      <link rel="canonical" href={currentUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:url" content={currentUrl} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:site_name" content={siteTitle} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={imageUrl} />
    </>
  );
}
