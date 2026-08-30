-- Let imported scraps be read after all.
--
-- The importer marked every row it wrote as extracted, on the grounds that the
-- export had supplied its metadata. An export supplies a title, sometimes a
-- cover, and nothing else — no site name, no reading time, no author, no
-- publication date. Marking those rows finished meant the pages were never read,
-- and because only a failed extraction offers a retry, there was no way back.
--
-- Imported rows are recognised by what their stored extraction result contains:
-- a real read always records siteName, falling back to the host when the page
-- does not name itself, so its absence means no page was ever read. Rows that
-- were genuinely read and simply have no cover are left alone.

update items
   set extract_status = 'pending',
       extracted_at = null
 where extract_status = 'ok'
   and not (auto_metadata ? 'siteName');
